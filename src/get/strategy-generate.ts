import {
  TSGetStrategy,
  TSIndex, TSPattern, TSRange,
  TSTermName,
} from '../types';
import QuadStore from '../quadstore';

const _ = require('../utils/lodash');


const strategyCache = new Map();
// TODO: keep cache size in check!

const getCachedStrategy = (pattern: TSPattern) => {
  return strategyCache.get(pattern);
};

const setCachedStrategy = (pattern: TSPattern, strategy: TSGetStrategy) => {
  strategyCache.set(pattern, strategy);
};

const omit = (o: object, p: string) => {
  const c = { ...o };
  // @ts-ignore
  delete c[p];
  return c;
};

const last = (a: any[]) => {
  return a[a.length - 1];
};

const addIndexMatch = (strategy: TSGetStrategy, term: TSTermName, valueOrRange: string|TSRange) => {
  switch (typeof(valueOrRange)) {
    case 'string':
      strategy.lt.push(valueOrRange);
      strategy.lte = true;
      strategy.gt.push(valueOrRange);
      strategy.gte = true;
      break;
    case 'object':
      if (!_.isSimpleObject(valueOrRange)) {
        throw new Error(`Unsupported`); // TODO improve error message
      }
      if (valueOrRange.lte) {
        strategy.lt.push(valueOrRange.lte);
        strategy.lte = true;
      } else if (valueOrRange.lt) {
        strategy.lt.push(valueOrRange.lt);
        strategy.lte = false;
      }
      if (valueOrRange.gte) {
        strategy.gt.push(valueOrRange.gte);
        strategy.gte = true;
      } else if (valueOrRange.gt) {
        strategy.gt.push(valueOrRange.gt);
        strategy.gte = false;
      }
      break;
    default:
      throw new Error('unsupported');
  }
};

const canAddIndexMatch = (strategy: TSGetStrategy) => {
  if (strategy.lte !== strategy.gte) {
    return false;
  }
  if (strategy.lt.length !== strategy.gt.length) {
    return false;
  }
  if (last(strategy.lt) !== last(strategy.gt)) {
    return false;
  }
  return true;
};

const populate = (pattern: TSPattern, indexTerms: TSTermName[], strategy: TSGetStrategy, store: QuadStore) => {
  if (Object.keys(pattern).length < 1) {
    return;
  }
  if (indexTerms.length < 1) {
    strategy.valid = false;
    return;
  }
  const term = indexTerms[0];
  const valueOrRange = pattern.hasOwnProperty(term) ? pattern[term] : null;
  if (!valueOrRange) {
    strategy.valid = false;
    return;
  }
  if (!canAddIndexMatch(strategy)) {
    strategy.valid = false;
    return;
  }
  addIndexMatch(strategy, term, valueOrRange);
  populate(omit(pattern, term), indexTerms.slice(1), strategy, store);
};

const generate = (store: QuadStore, pattern: TSPattern) => {
  let strategy = getCachedStrategy(pattern);
  if (strategy) {
    return strategy;
  }
  let i = 0;
  // @ts-ignore
  while (!strategy && i < store.indexes.length) {
    // @ts-ignore
    const index = store.indexes[i++];
    const localStrategy = {
      index,
      query: pattern,
      lt: [],
      gte: false,
      gt: [],
      lte: false,
      valid: true,
    };
    populate(pattern, index.terms, localStrategy, store);
    if (localStrategy.valid) {
      strategy = localStrategy;
    }
  }
  if (!strategy) {
    throw new Error(`Could not find strategy for query "${JSON.stringify(pattern)}"`);
  }
  setCachedStrategy(pattern, strategy);
  return strategy;
};

module.exports.generate = generate;
