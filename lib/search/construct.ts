
import {TSBinding, TSQuad, TSSimplePattern, TSTermName} from '../types/index.js';
import {termNames} from '../utils/index.js';

export const replaceBindingInPattern = (pattern: TSSimplePattern, binding: TSBinding): TSQuad => {
  const quad: TSSimplePattern = Object.create(null);
  termNames.forEach((termName: TSTermName)  => {
    const term = pattern[termName];
    if (!term) {
      throw new Error(`Incomplete pattern missing term "${termName}"`);
    }
    if (term.charAt(0) !== '?') {
      quad[termName] = term;
      return;
    }
    const bindingValue = binding[term];
    if (!bindingValue) {
      throw new Error(`Missing binding value for term "${termName}" with value "${term}"`);
    }
    quad[termName] = bindingValue;
  });
  return <TSQuad>quad;
};
