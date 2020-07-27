import QuadStore from '../quadstore.js';
import {
  TSApproximateSizeResult,
  TSEmptyOpts,
  TSPattern,
  TSQuadStreamResult,
  TSResultType,
} from '../types/index.js';
import {execute, executeApproximateSize} from './strategy-execute.js';
import {generate} from './strategy-generate.js';

export const getStream = async (store: QuadStore, matchTerms: TSPattern, opts: TSEmptyOpts): Promise<TSQuadStreamResult> => {
  const strategy = generate(store, matchTerms);
  const iterator = await execute(store, strategy, opts);
  return { type: TSResultType.QUADS, iterator, sorting: strategy.index.terms };
};

export const getApproximateSize = async (store: QuadStore, matchTerms: TSPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult> => {
  const strategy = generate(store, matchTerms);
  const approximateSize = await executeApproximateSize(store, strategy, opts);
  return { type: TSResultType.APPROXIMATE_SIZE, approximateSize };
};
