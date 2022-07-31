
import type { Quadstore } from '../quadstore';
import type { AsyncIterator } from 'asynciterator';
import type {
  ApproximateSizeResult,
  GetOpts,
  InternalIndex,
  Pattern,
  Prefixes,
  Quad,
  QuadStreamResultWithInternals,
  TermName,
} from '../types';
import type { AbstractIteratorOptions } from 'abstract-level';

import { ResultType, LevelQuery } from '../types';
import { arrStartsWith, emptyObject, separator } from '../utils';
import { LevelIterator } from './leveliterator';
import { quadReader, quadWriter, writePattern } from '../serialization';
import { SortingIterator } from './sortingIterator';
import {AbstractLevel} from 'abstract-level';
import {UInt8ArrayToValueBuffer} from '../serialization/utils';

const __value = new DataView(new ArrayBuffer(32));

const getLevelQueryForIndex = (pattern: Pattern, index: InternalIndex, prefixes: Prefixes, opts: GetOpts): LevelQuery<any, any>|null => {
  const indexQuery = writePattern(pattern, index, prefixes);
  if (indexQuery === null) {
    return null;
  }
  const levelOpts: AbstractIteratorOptions<any, any> = {
    [indexQuery.gte ? 'gte' : 'gt']: indexQuery.gt,
    [indexQuery.lte ? 'lte' : 'lt']: indexQuery.lt,
    keys: true,
    values: true,
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  };
  if (typeof opts.limit === 'number') {
    levelOpts.limit = opts.limit;
  }
  if (typeof opts.reverse === 'boolean') {
    levelOpts.reverse = opts.reverse;
  }
  return { level: levelOpts, order: indexQuery.order, index: indexQuery.index };
};

const getLevelQuery = (pattern: Pattern, indexes: InternalIndex[], prefixes: Prefixes, opts: GetOpts): LevelQuery<any, any>|null => {
  for (let i = 0, index; i < indexes.length; i += 1) {
    index = indexes[i];
    const levelQuery = getLevelQueryForIndex(pattern, index, prefixes, opts);
    if (levelQuery !== null && (!opts.order || arrStartsWith(levelQuery.order, opts.order))) {
      return levelQuery;
    }
  }
  return null;
};

export const getStream = async (store: Quadstore, pattern: Pattern, opts: GetOpts): Promise<QuadStreamResultWithInternals> => {
  const { dataFactory, prefixes, indexes } = store;

  const levelQueryFull = getLevelQuery(pattern, indexes, prefixes, opts);

  if (levelQueryFull !== null) {
    const { index, level, order } = levelQueryFull;
    let iterator: AsyncIterator<Quad> = new LevelIterator(store.db.iterator(level), (key: string, value: Uint8Array) => {
      return quadReader.read(key, index.prefix.length, UInt8ArrayToValueBuffer(value), 0, index.terms, dataFactory, prefixes);
    });
    return { type: ResultType.QUADS, order, iterator, index: index.terms, resorted: false };
  }

  const levelQueryNoOpts = getLevelQuery(pattern, indexes, prefixes, emptyObject);

  if (levelQueryNoOpts !== null) {
    const { index, level, order } = levelQueryNoOpts;
    let iterator: AsyncIterator<Quad> = new LevelIterator(store.db.iterator(level), (key: string, value: Uint8Array) => {
      return quadReader.read(key, index.prefix.length, UInt8ArrayToValueBuffer(value), 0, index.terms, dataFactory, prefixes);
    });
    if (typeof opts.order !== 'undefined' && !arrStartsWith(opts.order, order)) {
      const compare = opts.reverse === true
        ? (left: [Quad, string], right: [Quad, string]) => left[1] > right[1] ? -1 : 1
        : (left: [Quad, string], right: [Quad, string]) => left[1] > right[1] ? 1 : -1
      ;
      const digest = (item: Quad): [Quad, string] => {
        return [item, quadWriter.write('', __value, item, <TermName[]>opts.order, prefixes) + separator];
      };
      const emit = (item: [Quad, string]): Quad => {
        return item[0];
      }
      iterator = new SortingIterator<Quad, [Quad, string], Quad>(iterator, compare, digest, emit);
      if (typeof opts.limit !== 'undefined') {
        iterator = iterator.take(opts.limit);
      }
    }
    return {type: ResultType.QUADS, order: opts.order || order, iterator, index: index.terms, resorted: true };
  }

  throw new Error(`No index compatible with pattern ${JSON.stringify(pattern)} and options ${JSON.stringify(opts)}`);
};

interface AbstractLevelWithApproxSize extends AbstractLevel<any,  any, any> {
  approximateSize?: (start: string, end: string, cb: (err: Error | null, approximateSize: number) => any) => any;
}

export const getApproximateSize = async (store: Quadstore, pattern: Pattern, opts: GetOpts): Promise<ApproximateSizeResult> => {
  if (!(store.db as AbstractLevelWithApproxSize).approximateSize) {
    return { type: ResultType.APPROXIMATE_SIZE, approximateSize: Infinity };
  }
  const { indexes, prefixes } = store;
  const levelQuery = getLevelQuery(pattern, indexes, prefixes, opts);
  if (levelQuery === null) {
    throw new Error(`No index compatible with pattern ${JSON.stringify(pattern)} and options ${JSON.stringify(opts)}`);
  }
  const { level } = levelQuery;
  const start = level.gte || level.gt;
  const end = level.lte || level.lt;
  return new Promise((resolve, reject) => {
    (store.db as AbstractLevelWithApproxSize).approximateSize!(start, end, (err: Error|null, approximateSize: number) => {
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
