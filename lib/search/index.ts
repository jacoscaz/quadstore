
import pReduce from 'p-reduce';
import {termNames} from '../utils/index.js';
import {compileFilter} from './filtering.js';
import SortIterator from './iterators/sort-iterator.js';
import ai from 'asynciterator';
import NestedLoopJoinIterator from './iterators/nested-loop-join-iterator.js';
import {
  TSBgpSearchStage,
  TSBinding,
  TSBindingStreamResult,
  TSFilterSearchStage,
  TSParsedBgpSearchStage,
  TSParsedFilterSearchStage,
  TSParsedSearchStage,
  TSPattern,
  TSQuad,
  TSQuadStreamResult,
  TSResultType,
  TSSearchStage,
  TSTermName,
  TSTermsToVarsMap,
  TSVariables,
  TSVarsToTermsMap,
  TSSearchStageType, TSSimplePattern,
} from '../types';

import QuadStore from '../quadstore.js';



const getBindingsIterator = async (store: QuadStore, parsedPattern: TSParsedBgpSearchStage): Promise<TSBindingStreamResult> => {
  const {variables, pattern, termsToVarsMap} = parsedPattern;
  const results = await QuadStore.prototype.getStream.call(store, pattern, {});
  const sorting: TSTermName[] = results.sorting.reduce((acc: TSTermName[], termName: TSTermName) => {
    if (termsToVarsMap[termName]) {
      // @ts-ignore
      acc.push(termsToVarsMap[termName]);
    }
    return acc;
  }, <TSTermName[]>[]);
  let iterator: ai.AsyncIterator<TSBinding> = results.iterator.transform({ transform: function (quad: TSQuad, done: () => void) {
    const binding: TSBinding = {};
    for (const term in termsToVarsMap) {
      if (termsToVarsMap.hasOwnProperty(term)) {
        // @ts-ignore
        binding[termsToVarsMap[term]] = quad[term];
      }
    }
    // @ts-ignore
      this._push(binding);
    done();
  }});
  // iterator = filterFns.reduce((it, filterFn) => it.filter(filterFn), iterator);
  return { type: TSResultType.BINDINGS, iterator, sorting, variables };
};

const nestedLoopJoin = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage): Promise<TSBindingStreamResult> => {
  const nextCommonVarsToTermsMap: TSVarsToTermsMap = {};
  const nextAdditionalSortingTerms: string[] = [];
  for (const variableName in nextStage.variables) {
    if (nextStage.varsToTermsMap.hasOwnProperty(variableName)) {
      if (prevResult.variables.hasOwnProperty(variableName)) {
        nextCommonVarsToTermsMap[variableName] = nextStage.varsToTermsMap[variableName];
      } else {
        nextAdditionalSortingTerms.push(variableName);
      }
    }
  }
  const joinedSorting: string[] = [...prevResult.sorting, ...nextAdditionalSortingTerms];
  const nextSorting = joinedSorting.filter(variableName => nextStage.variables.hasOwnProperty(variableName));
  const getInnerIterator = async (outerBinding: TSBinding): Promise<ai.AsyncIterator<TSBinding>> => {
    const innerPattern: TSSimplePattern = {...nextStage.pattern};
    for (const variableName in nextCommonVarsToTermsMap) {
      innerPattern[nextCommonVarsToTermsMap[variableName]] = outerBinding[variableName];
    }
    const { iterator } = await getBindingsIterator(store, {
      type: TSSearchStageType.BGP,
      optional: false,
      pattern: innerPattern,
      termsToVarsMap: nextStage.termsToVarsMap,
      varsToTermsMap: nextStage.varsToTermsMap,
      variables: nextStage.variables,
    });
    // @ts-ignore
    const comparator = QuadStore.prototype._getQuadComparator.call(store, nextSorting);
    // @ts-ignore
    return new SortIterator<IBaseBinding>(<ai.AsyncIterator<IBaseBinding>>iterator, comparator);
  };
  const mergeItems = (firstBinding: TSBinding, secondBinding: TSBinding) => ({
    ...firstBinding,
    ...secondBinding,
  });
  return {
    iterator: new NestedLoopJoinIterator<TSBinding>(prevResult.iterator, getInnerIterator, mergeItems),
    variables: { ...prevResult.variables, ...nextStage.variables },
    // @ts-ignore
    sorting: joinedSorting,
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
  return { ...stage, variables, pattern, termsToVarsMap, varsToTermsMap };
}

const parseFilterSearchStage = (stage: TSFilterSearchStage): TSParsedFilterSearchStage => {
  const variables: { [key: string]: true } = {};
  stage.args.forEach((arg) => {
    if (arg.charAt(0) === '?') {
      variables[arg] = true;
    }
  });
  return { ...stage, variables };
}

const parseSearchStage = (stage: TSSearchStage): TSParsedSearchStage => {
  switch (stage.type) {
    case TSSearchStageType.BGP:
      return parseBgpSearchStage(stage);
    case TSSearchStageType.LT:
    case TSSearchStageType.LTE:
    case TSSearchStageType.GT:
    case TSSearchStageType.GTE:
      return parseFilterSearchStage(stage);
    default:
      // @ts-ignore
      throw new Error(`Unsupported search stage type "${stage.type}"`);
  }
}

const applyBgpSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage): Promise<TSBindingStreamResult> => {
  return await nestedLoopJoin(store, prevResult, nextStage);
}

const applyFilterSearchStage = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedFilterSearchStage): Promise<TSBindingStreamResult> => {
  // TODO: rework filter optimization by pushing filters down into nearest BGP
  // const variableNames = Object.keys(nextStage.variables);
  // if (variableNames.length === 1) {
  //   const matchTerms = {
  //     [parsedPattern.variables[variableNames[0]]]: filtering.getFilterTermRange(parsedFilter),
  //   };
  //   parsedPattern.filterMatchTerms = store._mergeMatchTerms(parsedPattern.filterMatchTerms, matchTerms, termNames);
  // }
  const filterFn = compileFilter(nextStage);
  const iterator = prevResult.iterator.filter(filterFn);
  return { ...prevResult, iterator };
}

const applySearchStage = async (store: QuadStore, prevResult: TSQuadStreamResult|TSBindingStreamResult, nextStage: TSParsedSearchStage): Promise<TSQuadStreamResult|TSBindingStreamResult> => {
  switch (nextStage.type) {
    case TSSearchStageType.BGP:
      if (prevResult.type !== TSResultType.BINDINGS) {
        throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
      }
      return await applyBgpSearchStage(store, prevResult, <TSParsedBgpSearchStage>nextStage);
    case TSSearchStageType.LT:
    case TSSearchStageType.LTE:
    case TSSearchStageType.GT:
    case TSSearchStageType.GTE:
      if (prevResult.type !== TSResultType.BINDINGS) {
        throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
      }
      return await applyFilterSearchStage(store, prevResult, <TSParsedFilterSearchStage>nextStage);
    default:
      // @ts-ignore
      throw new Error(`Unsupported search stage type "${nextStage.type}"`);
  }
}

export const searchStream = async (store: QuadStore, stages: TSSearchStage[]): Promise<TSQuadStreamResult|TSBindingStreamResult> => {
  const parsedStages = stages.map(parseSearchStage);
  // TODO: optimization pass including pushing filters down to nearest BGP stage
  return await pReduce(
    parsedStages.slice(1),
    applySearchStage.bind(null, store),
    await getBindingsIterator(store, <TSParsedBgpSearchStage>parsedStages[0]),
  );
};

