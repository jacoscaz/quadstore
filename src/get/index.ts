
import type { Quadstore } from '../quadstore.js';
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
} from '../types/index.js';
import type { AbstractIteratorOptions } from 'abstract-level';

import { ResultType, LevelQuery } from '../types/index.js';
import { arrStartsWith } from '../utils/stuff.js';
import { emptyObject, separator } from '../utils/constants.js';
import { LevelIterator } from './leveliterator.js';
import { quadReader, quadWriter, writePattern } from '../serialization/index.js';
import { SortingIterator } from './sortingiterator.js';
import { AbstractLevel } from 'abstract-level';
import { viewUint8ArrayAsUint16Array } from '../serialization/utils.js';

const SORTING_KEY = Symbol();

interface SortableQuad extends Quad {
  [SORTING_KEY]: string;
}

const compareSortableQuadsReverse = (left: SortableQuad, right: SortableQuad) => {
  return left[SORTING_KEY] > right[SORTING_KEY] ? -1 : 1;
};

const compareSortableQuads = (left: SortableQuad, right: SortableQuad) => {
  return left[SORTING_KEY] > right[SORTING_KEY] ? 1 : -1;
};

const emitSortableQuad = (item: SortableQuad): Quad => item;

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
      return quadReader.read(key, index.prefix.length, viewUint8ArrayAsUint16Array(value), 0, index.terms, dataFactory, prefixes);
    });
    return { type: ResultType.QUADS, order, iterator, index: index.terms, resorted: false };
  }

  const levelQueryNoOpts = getLevelQuery(pattern, indexes, prefixes, emptyObject);

  if (levelQueryNoOpts !== null) {
    const { index, level, order } = levelQueryNoOpts;
    let iterator: AsyncIterator<Quad> = new LevelIterator(store.db.iterator(level), (key: string, value: Uint8Array) => {
      return quadReader.read(key, index.prefix.length, viewUint8ArrayAsUint16Array(value), 0, index.terms, dataFactory, prefixes);
    });
    if (typeof opts.order !== 'undefined' && !arrStartsWith(opts.order, order)) {
      const digest = (item: Quad): SortableQuad => {
        (item as SortableQuad)[SORTING_KEY] = quadWriter.write('', undefined, 0, item, <TermName[]>opts.order, prefixes) + separator;
        return (item as SortableQuad);
      };
      const compare = opts.reverse === true ? compareSortableQuadsReverse : compareSortableQuads;
      iterator = new SortingIterator<Quad, SortableQuad, Quad>(iterator, compare, digest, emitSortableQuad);
      if (typeof opts.limit !== 'undefined') {
        const onEndOrError = function (this: AsyncIterator<any>) {
          this.removeListener('end', onEndOrError);
          this.removeListener('error', onEndOrError);
          this.destroy();
        };
        iterator = iterator.take(opts.limit)
          .on('end', onEndOrError)
          .on('error', onEndOrError);
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
