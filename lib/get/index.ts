
import type { Quadstore } from '../quadstore';
import type { ApproximateSizeResult, GetOpts, InternalIndex, Pattern, Prefixes, QuadStreamResult } from '../types';

import { ResultType } from '../types';
import { LevelIterator } from './leveliterator';
import { quadReader, writePattern } from '../serialization';

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
};

const getLevelOptsForIndex = (pattern: Pattern, index: InternalIndex, prefixes: Prefixes): LevelOpts|false => {
    const res = writePattern(pattern, index.prefix, index.terms, prefixes);
    return res ? {
      [res.gte ? 'gte' : 'gt']: res.gt,
      [res.lte ? 'lte' : 'lt']: res.lt,
      keys: true,
      values: true,
      keyAsBuffer: false,
      valueAsBuffer: true,
    } : false;
};

const selectIndexAndGetLevelOpts = (pattern: Pattern, indexes: InternalIndex[], prefixes: Prefixes): [InternalIndex, LevelOpts] => {
  for (let i = 0, index, levelOpts; i < indexes.length; i += 1) {
    index = indexes[i];
    levelOpts = getLevelOptsForIndex(pattern, index, prefixes);
    if (levelOpts) {
      return [index, levelOpts];
    }
  }
  throw new Error(`No index found for pattern ${JSON.stringify(pattern, null, 2)}`);
};

export const getStream = async (store: Quadstore, pattern: Pattern, opts?: GetOpts): Promise<QuadStreamResult> => {
  const { dataFactory, prefixes, indexes } = store;
  const [index, levelOpts] = selectIndexAndGetLevelOpts(pattern, indexes, prefixes);
  const iterator = new LevelIterator(store.db.iterator(levelOpts), (key: string, value: Buffer) => {
    return quadReader.read(key, index.prefix.length, value, 0, index.terms, dataFactory, prefixes);
  });
  return {type: ResultType.QUADS, iterator};
};

export const getApproximateSize = async (store: Quadstore, pattern: Pattern, opts?: GetOpts): Promise<ApproximateSizeResult> => {
  if (!store.db.approximateSize) {
    return { type: ResultType.APPROXIMATE_SIZE, approximateSize: Infinity };
  }
  const { indexes, prefixes } = store;
  const [, levelOpts] = selectIndexAndGetLevelOpts(pattern, indexes, prefixes);
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
