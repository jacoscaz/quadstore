
// import _ from '../utils/lodash';
import p from 'p-iteration';
import { resultType } from '../utils/enums';
// import filtering from './filtering';
import SortIterator from './iterators/sort-iterator';
import ai from 'asynciterator';
import NestedLoopJoinIterator from './iterators/nested-loop-join-iterator';
import {
  TParsedPattern,
  TQuadstoreQuad,
  IBaseStreamResults,
  IBaseBinding,
  TVariables,
  TMatchTerms,
  TVarsToTermsMap, TTermsToVarsMap, TFilter, TPattern, TParsedFilter
} from '../types';

import QuadStore from '../quadstore';
import {TTermName} from '../types';


const getBindingsIterator = async (store: QuadStore, parsedPattern: TParsedPattern): Promise<IBaseStreamResults> => {
  const {variables, matchTerms, termsToVarsMap} = parsedPattern;
  const results = await QuadStore.prototype.getStream.call(store, matchTerms, {});
  const sorting = results.sorting.reduce((acc: string[], termName: TTermName) => {
    if (termsToVarsMap[termName]) {
      // @ts-ignore
      acc.push(termsToVarsMap[termName]);
    }
    return acc;
  }, <string[]>[]);
  let iterator: ai.AsyncIterator<IBaseBinding> = results.iterator.transform({ transform: function (quad: TQuadstoreQuad, done: () => void) {
    const binding: {[key: string]: string} = {};
    for (const term in termsToVarsMap) {
      if (termsToVarsMap.hasOwnProperty(term)) {
        // @ts-ignore
        binding[termsToVarsMap[term]] = quad[term];
      }
    }
    this._push(binding);
    done();
  }});
  // iterator = filterFns.reduce((it, filterFn) => it.filter(filterFn), iterator);
  return { type: resultType.BINDINGS, iterator, sorting, variables };
};


/**
 *
 * @param store
 * @param {GetStreamResults} prev
 * @param {ParsedPattern} next
 * @returns {Promise<GetStreamResults>}
 */

const nestedLoopJoin = async (store: QuadStore, prev: IBaseStreamResults, next: TParsedPattern): Promise<IBaseStreamResults> => {

  const nextCommonVarsToTermsMap: { [key: string]: string } = {};

  const nextAdditionalSortingTerms: string[] = [];

  for (const variableName in next.variables) {
    if (next.varsToTermsMap.hasOwnProperty(variableName)) {
      if (prev.variables.hasOwnProperty(variableName)) {
        nextCommonVarsToTermsMap[variableName] = next.varsToTermsMap[variableName];
      } else {
        nextAdditionalSortingTerms.push(variableName);
      }
    }
  }

  const joinedSorting: string[] = [...prev.sorting, ...nextAdditionalSortingTerms];
  const nextSorting = joinedSorting.filter(variableName => next.variables.hasOwnProperty(variableName));

  const getInnerIterator = async (outerBinding: IBaseBinding): Promise<ai.AsyncIterator<IBaseBinding>> => {
    const innerMatchTerms = {...next.matchTerms};
    for (const variableName in nextCommonVarsToTermsMap) {
      innerMatchTerms[nextCommonVarsToTermsMap[variableName]] = outerBinding[variableName];
    }
    const { iterator } = await getBindingsIterator(store, {
      matchTerms: innerMatchTerms,
      termsToVarsMap: next.termsToVarsMap,
      varsToTermsMap: next.varsToTermsMap,
      variables: next.variables,
    });
    // @ts-ignore
    const comparator = QuadStore.prototype._getQuadComparator.call(store, nextSorting);
    // @ts-ignore
    return new SortIterator<IBaseBinding>(<ai.AsyncIterator<IBaseBinding>>iterator, comparator);
  };
  const mergeItems = (firstBinding: IBaseBinding, secondBinding: IBaseBinding) => ({
    ...firstBinding,
    ...secondBinding,
  });
  return {
    iterator: new NestedLoopJoinIterator<IBaseBinding>(prev.iterator, getInnerIterator, mergeItems),
    variables: { ...prev.variables, ...next.variables },
    // @ts-ignore
    sorting: joinedSorting,
    type: resultType.BINDINGS,
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

/**
 *
 * @param {string[]}termNames
 * @param pattern
 * @returns {ParsedPattern}
 */
const parsePattern = (termNames: TTermName[], pattern: TPattern) => {
  const variables: TVariables = {};
  const matchTerms: TMatchTerms = {};
  const varsToTermsMap: TVarsToTermsMap = {};
  const termsToVarsMap: TTermsToVarsMap = {};
  termNames.forEach((termName) => {
    if (pattern[termName]) {
      // @ts-ignore
      if (pattern[termName].charAt(0) === '?') {
        // @ts-ignore
        variables[pattern[termName]] = true;
        // @ts-ignore
        varsToTermsMap[pattern[termName]] = termName;
        termsToVarsMap[termName] = pattern[termName];
      } else {
        matchTerms[termName] = pattern[termName];
      }
    }
  });
  return { variables, matchTerms, termsToVarsMap, varsToTermsMap };
};

const parseFilter = (termNames: string[], filter: TFilter): TParsedFilter => {
  const variables: { [key: string]: true } = {};
  filter.args.forEach((arg) => {
    if (arg.charAt(0) === '?') {
      variables[arg] = true;
    }
  });
  return { ...filter, variables };
};

// const applyFilterToPattern = (store: QuadStore, termNames: string[], parsedFilter: any, parsedPattern: ParsedPattern) => {
//   const variableNames = Object.keys(parsedFilter.variables);
//   if (variableNames.length === 1) {
//     const matchTerms = {
//       [parsedPattern.variables[variableNames[0]]]: filtering.getFilterTermRange(parsedFilter),
//     };
//     parsedPattern.filterMatchTerms = store._mergeMatchTerms(parsedPattern.filterMatchTerms, matchTerms, termNames);
//   }
//   const filterFn = filtering.compileFilter(parsedFilter);
//   parsedPattern.filterFns.push(filterFn);
//   return parsedPattern;
// };


export const searchStream = async (store: QuadStore, pipeline: ISearchOp) => {

  const termNames = store._getTermNames();

  let parsedFilters = filters.map(filter => parseFilter(termNames, filter));
  let parsedPatterns: TParsedPattern[] = patterns.map(pattern => parsePattern(termNames, pattern));

  // parsedFilters.forEach((parsedFilter) => {
  //   parsedPatterns.forEach((parsedPattern) => {
  //     if (objectContains(parsedPattern.variables, parsedFilter.variables)) {
  //       applyFilterToPattern(store, termNames, parsedFilter, parsedPattern);
  //     }
  //   });
  // });

  return await p.reduce(parsedPatterns.slice(1), async (prev: IBaseStreamResults, next: TParsedPattern): Promise<IBaseStreamResults> => {
    return await nestedLoopJoin(store, prev, next);
  }, await getBindingsIterator(store, parsedPatterns[0]));

};

