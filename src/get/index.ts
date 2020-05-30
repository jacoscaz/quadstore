import QuadStore from '../quadstore';
import {TEmptyOpts, TGetSearchOpts, TQuadstoreMatchTerms} from '../types';

const { execute, executeApproximateSize } = require('./strategy-execute');
const { generate } = require('./strategy-generate');
const enums = require('../utils/enums');

const getStream = async (store: QuadStore, query: TQuadstoreMatchTerms, opts: TGetSearchOpts) => {
  const strategy = generate(store, query);
  const iterator = await execute(store, strategy, opts);
  return { type: enums.resultType.QUADS, iterator, sorting: strategy.index.terms };
};

module.exports.getStream = getStream;

const getApproximateSize = async (store: QuadStore, query: TQuadstoreMatchTerms, opts: TEmptyOpts) => {
  const strategy = generate(store, query);
  const approximateSize = await executeApproximateSize(store, strategy, opts);
  return { type: enums.resultType.APPROX_SIZE, approximateSize, sorting: strategy.index.terms };
};

module.exports.getApproximateSize = getApproximateSize;

