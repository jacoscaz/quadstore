
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
import type { AbstractIteratorOptions } from 'abstract-leveldown';

import { ResultType, LevelQuery } from '../types';
import { arrStartsWith, emptyObject, separator } from '../utils';
import { LevelIterator } from './leveliterator';
import { quadReader, quadWriter, writePattern } from '../serialization';
import { SortingIterator } from './sortingIterator';


const __raw = Symbol('raw')
const __value = Buffer.alloc(32);

const getLevelQueryForIndex = (pattern: Pattern, index: InternalIndex, prefixes: Prefixes, opts: GetOpts): LevelQuery|null => {
  const indexQuery = writePattern(pattern, index, prefixes);
  if (indexQuery === null) {
    return null;
  }
  const levelOpts: AbstractIteratorOptions = {
    [indexQuery.gte ? 'gte' : 'gt']: indexQuery.gt,
    [indexQuery.lte ? 'lte' : 'lt']: indexQuery.lt,
    keys: true,
    values: true,
    keyAsBuffer: false,
    valueAsBuffer: true,
  };
  if (typeof opts.limit === 'number') {
    levelOpts.limit = opts.limit;
  }
  if (typeof opts.reverse === 'boolean') {
    levelOpts.reverse = opts.reverse;
  }
  return { level: levelOpts, order: indexQuery.order, index: indexQuery.index };
};

const getLevelQuery = (pattern: Pattern, indexes: InternalIndex[], prefixes: Prefixes, opts: GetOpts): LevelQuery|null => {
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
    let iterator: AsyncIterator<Quad> = new LevelIterator(store.db.iterator(level), (key: string, value: Buffer) => {
      return quadReader.read(key, index.prefix.length, value, 0, index.terms, dataFactory, prefixes);
    });
    return { type: ResultType.QUADS, order, iterator, index: index.terms, resorted: false };
  }

  const levelQueryNoOpts = getLevelQuery(pattern, indexes, prefixes, emptyObject);

  if (levelQueryNoOpts !== null) {
    const { index, level, order } = levelQueryNoOpts;
    let iterator: AsyncIterator<Quad> = new LevelIterator(store.db.iterator(level), (key: string, value: Buffer) => {
      return quadReader.read(key, index.prefix.length, value, 0, index.terms, dataFactory, prefixes);
    });
    if (typeof opts.order !== 'undefined' && !arrStartsWith(opts.order, order)) {
      const compare = opts.reverse === true
        ? (left: Quad & { [__raw]: string }, right: Quad & { [__raw]: string }) => left[__raw] > right[__raw] ? -1 : 1
        : (left: Quad & { [__raw]: string }, right: Quad & { [__raw]: string }) => left[__raw] > right[__raw] ? 1 : -1
      ;
      const prepare = (item: Quad): Quad & { [__raw]: string } => {
        (<Quad & { [__raw]: string }>item)[__raw] = quadWriter.write('', __value, item, <TermName[]>opts.order, prefixes) + separator;
        return <Quad & { [__raw]: string }>item;
      };
      iterator = <AsyncIterator<Quad>><unknown>new SortingIterator<Quad, Quad & { [__raw]: string }>(iterator, compare, prepare);
      if (typeof opts.limit !== 'undefined') {
        iterator = iterator.take(opts.limit);
      }
    }
    return {type: ResultType.QUADS, order: opts.order || order, iterator, index: index.terms, resorted: true };
  }

  throw new Error(`No index compatible with pattern ${JSON.stringify(pattern)} and options ${JSON.stringify(opts)}`);
};

export const getApproximateSize = async (store: Quadstore, pattern: Pattern, opts: GetOpts): Promise<ApproximateSizeResult> => {
  if (!store.db.approximateSize) {
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
