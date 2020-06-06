import {
  IQSIndex,
  TQuadstoreMatchTerms,
  IQSStrategy,
  TTermName,
  IBaseRange
} from '../types';
import QuadStore from '../quadstore';

const _ = require('../utils/lodash');


const strategyCache = new Map();
// TODO: keep cache size in check!

const getCachedStrategy = (query: TQuadstoreMatchTerms) => {
  return strategyCache.get(query);
};

const setCachedStrategy = (query: TQuadstoreMatchTerms, strategy: IQSStrategy) => {
  strategyCache.set(query, strategy);
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

const addIndexMatch = (strategy: IQSStrategy, term: TTermName, valueOrRange: string|IBaseRange, store: QuadStore) => {
  switch (typeof(valueOrRange)) {
    case 'string':
    case 'number':
    case 'boolean':
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

const canAddIndexMatch = (strategy: IQSStrategy) => {
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

const populate = (query: TQuadstoreMatchTerms, indexTerms: TTermName[], strategy: IQSStrategy, store: QuadStore) => {
  if (Object.keys(query).length < 1) {
    return;
  }
  if (indexTerms.length < 1) {
    strategy.valid = false;
    return;
  }
  const term = indexTerms[0];
  const valueOrRange = query.hasOwnProperty(term) ? query[term] : null;
  if (!valueOrRange) {
    strategy.valid = false;
    return;
  }
  if (!canAddIndexMatch(strategy)) {
    strategy.valid = false;
    return;
  }
  addIndexMatch(strategy, term, valueOrRange, store);
  populate(omit(query, term), indexTerms.slice(1), strategy, store);
};

const generate = (store: QuadStore, query: TQuadstoreMatchTerms) => {
  let strategy = getCachedStrategy(query);
  if (strategy) {
    return strategy;
  }
  let i = 0;
  // @ts-ignore
  while (!strategy && i < store._indexes.length) {
    // @ts-ignore
    const index = store._indexes[i++];
    const localStrategy = {
      index,
      query,
      lt: [],
      gte: false,
      gt: [],
      lte: false,
      valid: true,
    };
    populate(query, index.terms, localStrategy, store);
    if (localStrategy.valid) {
      strategy = localStrategy;
    }
  }
  if (!strategy) {
    throw new Error(`Could not find strategy for query "${JSON.stringify(query)}"`);
  }
  setCachedStrategy(query, strategy);
  return strategy;
};

module.exports.generate = generate;
