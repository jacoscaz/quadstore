import {pReduce, termNames} from '../utils/index.js';
import {compileFilter} from './filtering.js';
import {AsyncIterator} from 'asynciterator';
import NestedLoopJoinIterator from './iterators/nested-loop-join-iterator.js';
import {
  TSBgpSearchStage,
  TSBinding,
  TSBindingStreamResult,
  TSConstructSearchStage,
  TSFilterSearchStage,
  TSParsedBgpSearchStage,
  TSParsedConstructSearchStage,
  TSParsedFilterSearchStage,
  TSParsedProjectSearchStage,
  TSParsedSearchStage, TSPattern,
  TSQuad,
  TSQuadStreamResult,
  TSResultType,
  TSSearchOpts,
  TSSearchStage,
  TSSearchStageType,
  TSSimplePattern,
  TSTermName,
  TSTermsToVarsMap,
  TSVariables,
  TSVarsToTermsMap,
} from '../types';

import {QuadStore} from '../quadstore.js';
import {replaceBindingInPattern} from './construct.js';
import {optimize} from './optimizer';


const getBindingsIterator = async (store: QuadStore, stage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  const {variables, parsedPattern, termsToVarsMap} = stage;
  const results = await store.getStream(parsedPattern, opts);
  const sorting: TSTermName[] = results.sorting.reduce((acc: TSTermName[], termName: TSTermName) => {
    if (termsToVarsMap[termName]) {
      // @ts-ignore
      acc.push(termsToVarsMap[termName]);
    }
    return acc;
  }, <TSTermName[]>[]);
  const termsToVarsMapEntries = Object.entries(termsToVarsMap);
  let iterator: AsyncIterator<TSBinding> = results.iterator.transform({ transform: function (quad: TSQuad, done: () => void, push) {
    const binding: TSBinding = Object.create(null);
    for (let e = 0, entry; e < termsToVarsMapEntries.length; e += 1) {
      entry = termsToVarsMapEntries[e];
      // @ts-ignore
      binding[entry[1]] = quad[entry[0]];
    }
    // for (const term in termsToVarsMap) {
    //   if (termsToVarsMap.hasOwnProperty(term)) {
    //     // @ts-ignore
    //     binding[termsToVarsMap[term]] = quad[term];
    //   }
    // }
    push(binding);
    done();
  }});
  return { type: TSResultType.BINDINGS, iterator, sorting, variables };
};

const nestedLoopJoin = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  const nextCommonVarsToTermsMap: TSVarsToTermsMap = {};
  for (const variableName in nextStage.variables) {
    if (nextStage.varsToTermsMap.hasOwnProperty(variableName)) {
      if (prevResult.variables.hasOwnProperty(variableName)) {
        nextCommonVarsToTermsMap[variableName] = nextStage.varsToTermsMap[variableName];
      }
    }
  }
  const getInnerIterator = async (outerBinding: TSBinding): Promise<AsyncIterator<TSBinding>> => {
    const innerPattern: TSSimplePattern = { ...nextStage.pattern };
    const innerParsedPattern: TSPattern = { ...nextStage.parsedPattern };
    for (const variableName in nextCommonVarsToTermsMap) {
      innerPattern[nextCommonVarsToTermsMap[variableName]] = outerBinding[variableName];
      innerParsedPattern[nextCommonVarsToTermsMap[variableName]] = outerBinding[variableName];
    }
    const { iterator } = await getBindingsIterator(store, {
      type: TSSearchStageType.BGP,
      optional: false,
      pattern: innerPattern,
      parsedPattern: innerParsedPattern,
      termsToVarsMap: nextStage.termsToVarsMap,
      varsToTermsMap: nextStage.varsToTermsMap,
      variables: nextStage.variables,
    }, opts);
    return iterator;
  };
  const mergeItems = (firstBinding: TSBinding, secondBinding: TSBinding) => ({
    ...firstBinding,
    ...secondBinding,
  });
  return {
    iterator: new NestedLoopJoinIterator<TSBinding>(prevResult.iterator, getInnerIterator, mergeItems),
    variables: { ...prevResult.variables, ...nextStage.variables },
    sorting: prevResult.sorting,
    type: TSResultType.BINDINGS,
  };
};

const objectContains = (outer: object, inner: object) => {
  for (const key in inner) {
    if (inner.hasOwnProperty(key)) {
      if (!outer.hasOwnProperty(key)) {
        return false;
      }
    }
  }
  return true;
};

const parseBgpSearchStage = (stage: TSBgpSearchStage): TSParsedBgpSearchStage => {
  const variables: TSVariables = {};
  const pattern: TSSimplePattern = {};
  const varsToTermsMap: TSVarsToTermsMap = {};
  const termsToVarsMap: TSTermsToVarsMap = {};
  termNames.forEach((termName: TSTermName) => {
    if (termName in stage.pattern) {
      const term = stage.pattern[termName];
      if (!term) return;
      if (term.charAt(0) === '?') {
        variables[term] = true;
        varsToTermsMap[term] = termName;
        termsToVarsMap[termName] = term;
      } else {
        pattern[termName] = term;
      }
    }
  });
  return { ...stage, variables, pattern, parsedPattern: pattern, termsToVarsMap, varsToTermsMap };
}

const parseFilterSearchStage = (stage: TSFilterSearchStage): TSParsedFilterSearchStage => {
  const variables: { [key: string]: true } = {};
  stage.args.forEach((arg, index: number) => {
    if (arg.charAt(0) === '?') {
      variables[arg] = true;
    } else {
      if (index === 0) {
        throw new Error(`The first argument of a search filter must always be a variable`);
      }
    }
  });
  return { ...stage, variables };
}

const parseMaterializeSearchStage = (stage: TSConstructSearchStage): TSParsedConstructSearchStage => {
  return stage;
};

const parseSearchStage = (stage: TSSearchStage): TSParsedSearchStage => {
  switch (stage.type) {
    case TSSearchStageType.BGP:
      return parseBgpSearchStage(stage);
    case TSSearchStageType.LT:
    case TSSearchStageType.LTE:
    case TSSearchStageType.GT:
    case TSSearchStageType.GTE:
    case TSSearchStageType.EQ:
    case TSSearchStageType.NEQ:
    case TSSearchStageType.STARTS_WITH:
    case TSSearchStageType.STARTS_WITHOUT:
      return parseFilterSearchStage(stage);
    case TSSearchStageType.CONSTRUCT:
      return parseMaterializeSearchStage(stage);
    case TSSearchStageType.PROJECT:
      return <TSParsedSearchStage>stage;
    default:
      // @ts-ignore
      throw new Error(`Unsupported search stage type "${stage.type}"`);
  }
}

const applyBgpSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  return await nestedLoopJoin(store, prevResult, nextStage, opts);
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

const applySearchStage = async (store: QuadStore, prevResult: TSQuadStreamResult|TSBindingStreamResult, nextStage: TSParsedSearchStage, opts?: TSSearchOpts): Promise<TSQuadStreamResult|TSBindingStreamResult> => {
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

