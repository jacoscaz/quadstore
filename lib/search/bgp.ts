import {QuadStore} from '../quadstore';
import {
  TSBinding,
  TSBindingStreamResult,
  TSParsedBgpSearchStage,
  TSQuad,
  TSResultType,
  TSSearchOpts,
  TSTermName, TSTermsToVarsMap
} from '../types';
import {AsyncIterator} from 'asynciterator';

type TSQuadToBindingFn = (quad: TSQuad) => TSBinding;

const getQuadToBindingFn = (termsToVars: TSTermsToVarsMap): TSQuadToBindingFn => {
  let fn = '(quad) => {';
  fn += '\n  const binding = Object.create(null);';
  Object.entries(termsToVars).forEach(([termName, variableName]) => {
    fn += `\n  binding['${variableName}'] = quad.${termName};`;
  });
  fn += '\n  return binding;'
  fn += '\n}';
  return eval(fn);
};

export const getBindingsIterator = async (store: QuadStore, stage: TSParsedBgpSearchStage, opts?: TSSearchOpts): Promise<TSBindingStreamResult> => {
  const {variables, parsedPattern, termsToVarsMap} = stage;
  const results = await store.getStream(parsedPattern, opts);
  const sorting: TSTermName[] = results.sorting.reduce((acc: TSTermName[], termName: TSTermName) => {
    if (termsToVarsMap[termName]) {
      // @ts-ignore
      acc.push(termsToVarsMap[termName]);
    }
    return acc;
  }, <TSTermName[]>[]);
  const quadToBinding = getQuadToBindingFn(termsToVarsMap);
  let iterator: AsyncIterator<TSBinding> = results.iterator.map(quadToBinding);
  return { type: TSResultType.BINDINGS, iterator, sorting, variables };
};
