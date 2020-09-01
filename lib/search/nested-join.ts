import {QuadStore} from '../quadstore';
import {
  TSBinding,
  TSBindingStreamResult,
  TSParsedBgpSearchStage, TSPattern, TSResultType,
  TSSearchOpts, TSSearchStageType,
  TSSimplePattern,
  TSVariables,
  TSVarsToTermsMap,
} from '../types';
import {AsyncIterator} from 'asynciterator';
import NestedLoopJoinIterator from './iterators/nested-loop-join-iterator';
import {getBindingsIterator} from './bgp';

type TSMergeBindingsFn = (a: TSBinding, b: TSBinding) => TSBinding;
type TSFillPatternWithBindingFn = <T extends TSSimplePattern|TSPattern>(p: T, b: TSBinding) => T;

const getMergeBindingsFn = (firstVars: TSVariables, secondVars: TSVariables): TSMergeBindingsFn => {
  let fn = '(firstBinding, secondBinding) => {';
  fn += '\n  const mergedBinding = Object.create(null);';
  Object.keys(firstVars).forEach((variableName) => {
    fn += `\n  mergedBinding['${variableName}'] = firstBinding['${variableName}'];`;
  });
  Object.keys(secondVars).forEach((variableName) => {
    fn += `\n  mergedBinding['${variableName}'] = secondBinding['${variableName}'];`;
  });
  fn += '\n  return mergedBinding;';
  fn += '};';
  return eval(fn);
};

const getFillPatternWithBindingFn = (varToTermsMap: TSVarsToTermsMap): TSFillPatternWithBindingFn => {
  let fn = '(pattern, binding) => {';
  fn += '\n  const filled = { ...pattern };';
  Object.entries(varToTermsMap).forEach(([variableName, termName]) => {
    fn += `\n  filled['${termName}'] = binding['${variableName}'];`;
  });
  fn += '\n  return filled;';
  fn += '\n};';
  return eval(fn);
};

export const nestedJoin = async (store: QuadStore, prevResult: TSBindingStreamResult, nextStage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  const fillPatternWithBinding = getFillPatternWithBindingFn(nextStage.varsToTermsMap);
  const getInnerIterator = async (outerBinding: TSBinding): Promise<AsyncIterator<TSBinding>> => {
    const { iterator } = await getBindingsIterator(store, {
      type: TSSearchStageType.BGP,
      optional: false,
      pattern: fillPatternWithBinding(nextStage.pattern, outerBinding),
      parsedPattern: fillPatternWithBinding(nextStage.parsedPattern, outerBinding),
      termsToVarsMap: nextStage.termsToVarsMap,
      varsToTermsMap: nextStage.varsToTermsMap,
      variables: nextStage.variables,
    }, opts);
    return iterator;
  };
  const mergeBindings = getMergeBindingsFn(prevResult.variables, nextStage.variables);
  return {
    iterator: new NestedLoopJoinIterator<TSBinding>(prevResult.iterator, getInnerIterator, mergeBindings),
    variables: { ...prevResult.variables, ...nextStage.variables },
    sorting: prevResult.sorting,
    type: TSResultType.BINDINGS,
  };
};
