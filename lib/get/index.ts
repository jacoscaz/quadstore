import {QuadStore} from '../quadstore.js';
import {
  TSApproximateSizeResult,
  TSDefaultGraphMode,
  TSGetOpts,
  TSPattern,
  TSQuadStreamResult,
  TSResultType,
  TSTermName,
  TSIndex,
  TSRange,
} from '../types';
import {SimpleTransformIterator} from 'asynciterator';
import {deserializeQuad} from '../utils';

type TSPatternTypes = Record<TSTermName, string>;
type TSIndexMatchFn = (patternTypes: TSPatternTypes) => boolean;
type TSIndexMatchFnPair = [TSIndex, TSIndexMatchFn];

type TSRangeOpts = {
  lt: string,
  gt: string,
  limit?: number,
  offset?: number,
  lte: boolean,
  ltr: boolean,
  gte: boolean,
  gtr: boolean,
  index: TSIndex
};

type TSLevelOpts = {
  lt?: string,
  lte?: string,
  gt?: string,
  gte?: string,
  limit?: number,
  offset?: number,
  reverse?: boolean,
};

let indexMatchFnPair: TSIndexMatchFnPair[] = [];

const getPatternTypes = (pattern: TSPattern): TSPatternTypes => {
  return {
    subject: typeof pattern.subject,
    predicate: typeof pattern.predicate,
    object: typeof pattern.object,
    graph: typeof pattern.graph,
  };
};

const getIndexMatchFn = (index: TSIndex): TSIndexMatchFn => {
  const { terms } = index;
  let fn = `
    (patternTypes) => {
      let gotRange = false;
      let gotUndefined  = false;
  `;
  for (let i = 0; i < terms.length; i += 1) {
    fn += `
      if (patternTypes.${terms[i]} === 'undefined') {
        if (!gotUndefined) { gotUndefined = true; }
      } else {
        if (gotUndefined) { return false; }
        if (gotRange) { return false; }
        if (patternTypes.${terms[i]} === 'object') { gotRange = true; }
      }
    `;
  }
  fn += `
      return true;
    }
  `;
  return eval(fn);
};

const getIndexMatchFnPairs = (store: QuadStore): TSIndexMatchFnPair[] => {
  return store.indexes.map(index => [index, getIndexMatchFn(index)]);
};

const selectIndex = (pattern: TSPattern): TSIndex|undefined => {
  const patternTypes = getPatternTypes(pattern);
  const pair = indexMatchFnPair.find(pair => pair[1](patternTypes));
  return pair === undefined ? pair : pair[0];
};

const capRangeOpts = (rangeOpts: TSRangeOpts, store: QuadStore, index: TSIndex) => {
  if (rangeOpts.lte) {
    if (rangeOpts.ltr) {
      rangeOpts.lt += store.boundary;
    } else {
      rangeOpts.lt += store.separator + store.boundary;
    }
  } else {
    if (rangeOpts.ltr) {
      rangeOpts.lt += store.separator;
    } else {
      rangeOpts.lt += store.separator;
    }
  }
  if (rangeOpts.gte) {
    if (!rangeOpts.gtr) {
      rangeOpts.gt += store.separator;
    }
  } else {
    if (rangeOpts.gtr) {
      rangeOpts.gt += store.boundary;
    } else {
      rangeOpts.gt += store.separator + store.boundary;
    }
  }
}

const fillRangeOpts = (levelOpts: TSRangeOpts, store: QuadStore, index: TSIndex, term: TSTermName, valueOrRange: string|TSRange|undefined) => {
  switch (typeof(valueOrRange)) {
    case 'string':
      levelOpts.lt += store.separator + valueOrRange;
      levelOpts.gt += store.separator + valueOrRange;
      levelOpts.lte = true;
      levelOpts.gte = true;
      levelOpts.ltr = false;
      levelOpts.gtr = false;
      break;
    case 'object':
      if (valueOrRange.lte) {
        levelOpts.lt += store.separator + valueOrRange.lte;
        levelOpts.lte = true;
        levelOpts.ltr = true;
      } else if (valueOrRange.lt) {
        levelOpts.lt += store.separator + valueOrRange.lt;
        levelOpts.lte = false;
        levelOpts.ltr = true;
      }
      if (valueOrRange.gte) {
        levelOpts.gt += store.separator + valueOrRange.gte;
        levelOpts.gte = true;
        levelOpts.gtr = true;
      } else if (valueOrRange.gt) {
        levelOpts.gt += store.separator + valueOrRange.gt;
        levelOpts.gte = false;
        levelOpts.gtr = true;
      }
      break;
    case 'undefined':
      break;
    default:
      throw new Error('unsupported');
  }
};

export const getRangeOpts = (store: QuadStore, pattern: TSPattern, opts?: TSGetOpts): TSRangeOpts => {
  let index = selectIndex(pattern);
  if (index === undefined) {
    throw new Error(`No index found for pattern ${JSON.stringify(pattern)}`);
  }
  const rangeOpts: TSRangeOpts = {
    index: index,
    lt: index.name,
    gt: index.name,
    lte: true,
    ltr: false,
    gte: true,
    gtr: false,
    limit: opts ? opts.limit : undefined,
    offset: opts ? opts.offset : undefined,
  };
  for (let i = 0, termName; i < index.terms.length; i += 1) {
    termName = index.terms[i];
    fillRangeOpts(rangeOpts, store, index, termName, pattern[termName]);
  }
  capRangeOpts(rangeOpts, store, index);
  return rangeOpts;
};

const rangeToLevelOpts = (rangeOpts: TSRangeOpts): TSLevelOpts => {
  const levelOpts: TSLevelOpts = {};
  if (rangeOpts.lte) levelOpts.lte = rangeOpts.lt;
  else if (rangeOpts.lt) levelOpts.lt = rangeOpts.lt;
  if (rangeOpts.gte) levelOpts.gte = rangeOpts.gt;
  else if (rangeOpts.gt) levelOpts.gt = rangeOpts.gt;
  if (rangeOpts.limit) levelOpts.limit = rangeOpts.limit;
  if (rangeOpts.offset) levelOpts.offset = rangeOpts.offset;
  return levelOpts;
};

export const getInit = (store: QuadStore): void => {
  indexMatchFnPair = getIndexMatchFnPairs(store);
};

export const getStream = async (store: QuadStore, pattern: TSPattern, opts?: TSGetOpts): Promise<TSQuadStreamResult> => {
  if (opts) {
    if (opts.defaultGraphMode
      && opts.defaultGraphMode === TSDefaultGraphMode.DEFAULT
      && !pattern[TSTermName.GRAPH]) {
      pattern = { ...pattern, graph: store.defaultGraph };
    }
  }
  const rangeOpts = getRangeOpts(store, pattern, opts);
  const levelOpts = rangeToLevelOpts(rangeOpts);
  const iterator = new SimpleTransformIterator(
    store.db.createValueStream(levelOpts),
    { map: deserializeQuad },
  );
  return { type: TSResultType.QUADS, iterator, sorting: rangeOpts.index.terms };
};

export const getApproximateSize = async (store: QuadStore, pattern: TSPattern, opts?: TSGetOpts): Promise<TSApproximateSizeResult> => {
  if (opts) {
    if (opts.defaultGraphMode
      && opts.defaultGraphMode === TSDefaultGraphMode.DEFAULT
      && !pattern[TSTermName.GRAPH]) {
      pattern = { ...pattern, graph: store.defaultGraph };
    }
  }
  if (!store.db.approximateSize) {
    return { type: TSResultType.APPROXIMATE_SIZE, approximateSize: Infinity };
  }
  const rangeOpts = getRangeOpts(store, pattern, opts);
  const levelOpts = rangeToLevelOpts(rangeOpts);
  const start = levelOpts.gte || levelOpts.gt;
  const end = levelOpts.lte || levelOpts.lt;
  return new Promise((resolve, reject) => {
    store.db.approximateSize(start, end, (err: Error|null, approximateSize: number) => {
      err ? reject(err) : resolve({ type: TSResultType.APPROXIMATE_SIZE, approximateSize });
    });
  });
};
