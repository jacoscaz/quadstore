import {pReduce} from '../utils/index.js';
import {
  TSBindingStreamResult,
  TSParsedSearchStage,
  TSQuadStreamResult,
  TSSearchOpts,
  TSSearchStage,
  TSSearchStageType,
} from '../types';
import {parseSearchStage} from './parse';
import {applySearchStage} from './apply';
import {QuadStore} from '../quadstore.js';
import {optimize} from './optimizer';
import {getBindingsIterator} from './bgp';

export const searchStream = async (store: QuadStore, stages: TSSearchStage[], opts?: TSSearchOpts): Promise<TSQuadStreamResult|TSBindingStreamResult> => {
  let parsedStages = stages.map(parseSearchStage);
  parsedStages = await optimize(store, parsedStages);
  if (parsedStages.length < 1) {
    throw new Error(`Search with no stages`);
  }
  if (parsedStages[0].type !== TSSearchStageType.BGP) {
    throw new Error(`The first stage in a search must be of type "BGP"`);
  }
  const result = await pReduce(
    parsedStages.slice(1),
    (prevResult: TSQuadStreamResult|TSBindingStreamResult, nextStage: TSParsedSearchStage) => {
      return applySearchStage(store, prevResult, nextStage, opts);
    },
    await getBindingsIterator(store, parsedStages[0], opts),
  );
  if (opts) {
    if (opts.offset) {
      result.iterator = result.iterator.skip(opts.offset);
    }
    if (opts.limit) {
      result.iterator = result.iterator.take(opts.limit);
    }
  }
  return result;
};

