import {QuadStore} from '../quadstore';
import {
  TSBinding,
  TSBindingStreamResult,
  TSParsedBgpSearchStage, TSPattern, TSResultType,
  TSSearchOpts, TSSearchStageType,
  TSSimplePattern,
  TSTermName
} from '../types';
import {AsyncIterator} from 'asynciterator';
import NestedLoopJoinIterator from './iterators/nested-loop-join-iterator';
import {getBindingsIterator} from './bgp';

export const nestedJoin = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  const nextCommonVarsToTermsMap: [string, TSTermName][] = [];
  for (let v = 0, variableNames = Object.keys(nextStage.variables), variableName; v < variableNames.length; v += 1) {
    variableName = variableNames[v];
    nextCommonVarsToTermsMap.push([variableName, nextStage.varsToTermsMap[variableName]]);
  }
  const getInnerIterator = async (outerBinding: TSBinding): Promise<AsyncIterator<TSBinding>> => {
    const innerPattern: TSSimplePattern = { ...nextStage.pattern };
    const innerParsedPattern: TSPattern = { ...nextStage.parsedPattern };
    for (let e = 0, entry; e < nextCommonVarsToTermsMap.length; e += 1) {
      entry = nextCommonVarsToTermsMap[e];
      // @ts-ignore
      innerPattern[entry[1]] = outerBinding[entry[0]];
      // @ts-ignore
      innerParsedPattern[entry[1]] = outerBinding[entry[0]];
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
