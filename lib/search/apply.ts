import {QuadStore} from '../quadstore';
import {
  TSBinding,
  TSBindingStreamResult,
  TSParsedBgpSearchStage,
  TSParsedConstructSearchStage,
  TSParsedFilterSearchStage, TSParsedProjectSearchStage, TSParsedSearchStage, TSQuad, TSQuadStreamResult, TSResultType,
  TSSearchOpts, TSSearchStageType, TSVariables
} from '../types';
import {compileFilter} from './filtering';
import {replaceBindingInPattern} from './construct';
import {nestedJoin} from './nested-join';

const applyBgpSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  return await nestedJoin(store, prevResult, nextStage, opts);
};

const applyFilterSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedFilterSearchStage): Promise<TSBindingStreamResult> => {
  const filterFn = compileFilter(nextStage);
  const iterator = prevResult.iterator.filter(filterFn);
  return { ...prevResult, iterator };
};

const applyConstructSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedConstructSearchStage): Promise<TSQuadStreamResult> => {
  const { patterns } = nextStage;
  return {
    type: TSResultType.QUADS,
    iterator: prevResult.iterator.transform({
      transform: (binding, done: () => void, push: (quad: TSQuad) => void) => {
        patterns.forEach((pattern) => {
          push(replaceBindingInPattern(pattern, binding));
        });
        done();
      },
    }),
    sorting: [],
  };
};

const applyProjectSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedProjectSearchStage): Promise<TSBindingStreamResult> => {

  const { variables: projectionVariables } = nextStage;
  const { variables: prevResultVariables } = prevResult;
  const nextResultVariables: TSVariables = Object.create(null);

  for (let v = 0, pVar; v < projectionVariables.length; v += 1) {
    pVar = projectionVariables[v];
    if (pVar === '*') {
      return prevResult;
    }
    if (!prevResultVariables[pVar]) {
      throw new Error(`Unknown variable "${pVar}"`);
    }
    nextResultVariables[pVar] = true;
  }

  const nextResultSorting = prevResult.sorting.filter(variable => nextResultVariables[variable]);

  const nextResultIterator = prevResult.iterator.map((binding: TSBinding) => {
    const projectedBinding: TSBinding = {};
    for (let i = 0, pVar; i < projectionVariables.length; i += 1) {
      pVar = projectionVariables[i];
      projectedBinding[pVar] = binding[pVar];
    }
    return projectedBinding;
  });

  return {
    ...prevResult,
    iterator: nextResultIterator,
    sorting: nextResultSorting,
    variables: nextResultVariables,
  };
};

export const applySearchStage = async (store: QuadStore, prevResult: TSQuadStreamResult|TSBindingStreamResult, nextStage: TSParsedSearchStage, opts?: TSSearchOpts): Promise<TSQuadStreamResult|TSBindingStreamResult> => {
  switch (nextStage.type) {
    case TSSearchStageType.BGP:
      if (prevResult.type !== TSResultType.BINDINGS) {
        throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
      }
      return await applyBgpSearchStage(store, prevResult, nextStage, opts);
    case TSSearchStageType.LT:
    case TSSearchStageType.LTE:
    case TSSearchStageType.GT:
    case TSSearchStageType.GTE:
    case TSSearchStageType.EQ:
    case TSSearchStageType.NEQ:
    case TSSearchStageType.STARTS_WITH:
    case TSSearchStageType.STARTS_WITHOUT:
      if (prevResult.type !== TSResultType.BINDINGS) {
        throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
      }
      return await applyFilterSearchStage(store, prevResult, nextStage);
    case TSSearchStageType.CONSTRUCT:
      if (prevResult.type !== TSResultType.BINDINGS) {
        throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
      }
      return await applyConstructSearchStage(store, prevResult, nextStage);
    case TSSearchStageType.PROJECT:
      if (prevResult.type !== TSResultType.BINDINGS) {
        throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
      }
      return await applyProjectSearchStage(store, prevResult, nextStage);
    default:
      // @ts-ignore
      throw new Error(`Unsupported search stage type "${nextStage.type}"`);
  }
};

