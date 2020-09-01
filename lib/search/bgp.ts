import {QuadStore} from '../quadstore';
import {
  TSBinding,
  TSBindingStreamResult,
  TSParsedBgpSearchStage,
  TSQuad,
  TSResultType,
  TSSearchOpts,
  TSTermName
} from '../types';
import {AsyncIterator} from 'asynciterator';

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
  const termsToVarsMapEntries = Object.entries(termsToVarsMap);
  let iterator: AsyncIterator<TSBinding> = results.iterator.transform({ transform: function (quad: TSQuad, done: () => void, push) {
      const binding: TSBinding = Object.create(null);
      for (let e = 0, entry; e < termsToVarsMapEntries.length; e += 1) {
        entry = termsToVarsMapEntries[e];
        // @ts-ignore
        binding[entry[1]] = quad[entry[0]];
      }
      push(binding);
      done();
    }});
  return { type: TSResultType.BINDINGS, iterator, sorting, variables };
};
