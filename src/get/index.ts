import QuadStore from '../quadstore';
import {
  TSApproximateSizeResult,
  TSEmptyOpts, TSPattern, TSQuadStreamResult

} from '../types';
import {} from '../types/base';

const { execute, executeApproximateSize } = require('./strategy-execute');
const { generate } = require('./strategy-generate');
const enums = require('../utils/enums');

const getStream = async (store: QuadStore, matchTerms: TSPattern, opts: TSEmptyOpts): Promise<TSQuadStreamResult> => {
  const strategy = generate(store, matchTerms);
  const iterator = await execute(store, strategy, opts);
  return { type: enums.resultType.QUADS, iterator, sorting: strategy.index.terms };
};

module.exports.getStream = getStream;

const getApproximateSize = async (store: QuadStore, matchTerms: TSPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult> => {
  const strategy = generate(store, matchTerms);
  const approximateSize = await executeApproximateSize(store, strategy, opts);
  return { type: enums.resultType.APPROX_SIZE, approximateSize };
};

module.exports.getApproximateSize = getApproximateSize;

