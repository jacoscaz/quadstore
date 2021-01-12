import {
  ApproximateSizeResult,
  DefaultGraphMode,
  GetOpts,
  InternalIndex,
  QuadStreamResult,
  ResultType,
  TermName,
  Pattern,
} from '../types';
import {EmptyIterator} from 'asynciterator';
import {Quadstore} from '../quadstore';
import {emptyObject} from '../utils';
import {LevelIterator} from './leveliterator';
import {writePattern, copyBufferIntoBuffer, quadReader} from '../serialization';



type LevelOpts = {
  keys?: boolean,
  values?: boolean,
  keyAsBuffer?: boolean,
  valueAsBuffer?: boolean,
  lt?: string|Buffer,
  lte?: string|Buffer,
  gt?: string|Buffer,
  gte?: string|Buffer,
  limit?: number,
  offset?: number,
  reverse?: boolean,
  ___index: InternalIndex,
};


const reconcilePatternWithDefaultGraphMode = (pattern: Pattern, store: Quadstore, opts: GetOpts = emptyObject): Pattern => {
  const defaultGraphMode = opts.defaultGraphMode || store.defaultGraphMode;
  if (defaultGraphMode === DefaultGraphMode.DEFAULT && !pattern[TermName.GRAPH]) {
    return {
      ...pattern,
      [TermName.GRAPH]: store.dataFactory.defaultGraph(),
    };
  }
  if (store.sparqlMode && defaultGraphMode === DefaultGraphMode.UNION && pattern[TermName.GRAPH]?.termType === 'DefaultGraph') {
    return {
      [TermName.SUBJECT]: pattern[TermName.SUBJECT],
      [TermName.PREDICATE]: pattern[TermName.PREDICATE],
      [TermName.OBJECT]: pattern[TermName.OBJECT],
    };
  }
  return pattern;
};

const getLevelOpts = (pattern: Pattern, store: Quadstore): LevelOpts => {

  for (let i = 0, index; i < store.indexes.length; i += 1) {

    index = store.indexes[i];

    const res = writePattern(pattern, index.prefix, store.separator, store.boundary, index.terms, store.prefixes);

    if (res) {
      return {
        [res.gte ? 'gte' : 'gt']: res.gt,
        [res.lte ? 'lte' : 'lt']: res.lt,
        keys: true,
        values: true,
        keyAsBuffer: false,
        valueAsBuffer: true,
        ___index: index,
      };
    }
  }

  throw new Error(`No index found`);
};

export const getStream = async (store: Quadstore, pattern: Pattern, opts?: GetOpts): Promise<QuadStreamResult> => {
  pattern = reconcilePatternWithDefaultGraphMode(pattern, store, opts);
  const levelOpts = getLevelOpts(pattern, store);
  const { dataFactory, prefixes, separator } = store;
  const iterator = new LevelIterator(store.db.iterator(levelOpts), (key: string, value: Buffer) => {
    return quadReader.read(key, levelOpts.___index.prefix.length, value, 0, separator, levelOpts.___index.terms, dataFactory, prefixes);
  });
  return { type: ResultType.QUADS, iterator };
};

export const getApproximateSize = async (store: Quadstore, pattern: Pattern, opts?: GetOpts): Promise<ApproximateSizeResult> => {
  pattern = reconcilePatternWithDefaultGraphMode(pattern, store, opts);
  if (!store.db.approximateSize) {
    return { type: ResultType.APPROXIMATE_SIZE, approximateSize: Infinity };
  }
  const levelOpts = getLevelOpts(pattern, store);
  const start = levelOpts.gte || levelOpts.gt;
  const end = levelOpts.lte || levelOpts.lt;
  return new Promise((resolve, reject) => {
    store.db.approximateSize(start, end, (err: Error|null, approximateSize: number) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        type: ResultType.APPROXIMATE_SIZE,
        approximateSize: Math.max(1, approximateSize),
      });
    });
  });
};
