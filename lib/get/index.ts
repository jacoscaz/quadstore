import {QuadStore} from '../quadstore.js';
import {
  TSApproximateSizeResult,
  TSDefaultGraphMode,
  TSGetOpts,
  TSPattern,
  TSQuadStreamResult,
  TSResultType,
  TSTermName,
} from '../types/index.js';
import {execute, executeApproximateSize} from './strategy-execute.js';
import {generate} from './strategy-generate.js';

export const getStream = async (store: QuadStore, pattern: TSPattern, opts?: TSGetOpts): Promise<TSQuadStreamResult> => {
  if (opts) {
    if (opts.defaultGraphMode
      && opts.defaultGraphMode === TSDefaultGraphMode.DEFAULT
      && !pattern[TSTermName.GRAPH]) {
      pattern = { ...pattern, graph: store.defaultGraph };
    }
  }
  const strategy = generate(store, pattern);
  const iterator = await execute(store, strategy, opts);
  return { type: TSResultType.QUADS, iterator, sorting: strategy.index.terms };
};

export const getApproximateSize = async (store: QuadStore, pattern: TSPattern, opts?: TSGetOpts): Promise<TSApproximateSizeResult> => {
  if (opts) {
    if (opts.defaultGraphMode
      && opts.defaultGraphMode === TSDefaultGraphMode.DEFAULT
      && !pattern[TSTermName.GRAPH]) {
      pattern = { ...pattern, graph: store.defaultGraph };
    }
  }
  const strategy = generate(store, pattern);
  const approximateSize = await executeApproximateSize(store, strategy, opts);
  return { type: TSResultType.APPROXIMATE_SIZE, approximateSize };
};
