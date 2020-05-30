
import _ from '../utils/lodash';
import p from 'p-iteration';
import enums from '../utils/enums';
import filtering from './filtering';
import SortIterator from './iterators/sort-iterator';
import ai from 'asynciterator';
import NestedLoopJoinIterator from './iterators/nested-loop-join-iterator';
import { ParsedPattern, Quad, GetStreamResults, Binding } from './types';

import QuadStore from '../quadstore';
import {TQuadstoreTermName} from '../types';


const getBindingsIterator = async (store: QuadStore, parsedPattern: ParsedPattern): Promise<GetStreamResults> => {
  const {variables, matchTerms, termsToVarsMap} = parsedPattern;
  const results = await QuadStore.prototype.getStream.call(store, matchTerms, {});
  const sorting = results.sorting.reduce((acc: string[], termName: string) => {
    if (termsToVarsMap[termName]) {
      acc.push(termsToVarsMap[termName]);
    }
    return acc;
  }, <string[]>[]);
  let iterator: ai.AsyncIterator<Binding> = results.iterator.transform({ transform: function (quad: Quad, done: () => void) {
    const binding: {[key: string]: string} = {};
    for (const term in termsToVarsMap) {
      if (termsToVarsMap.hasOwnProperty(term)) {
        binding[termsToVarsMap[term]] = quad[term];
      }
    }
    this._push(binding);
    done();
  }});
  // iterator = filterFns.reduce((it, filterFn) => it.filter(filterFn), iterator);
  return { type: enums.resultType.BINDINGS, iterator, sorting, variables };
};


/**
 *
 * @param store
 * @param {GetStreamResults} prev
 * @param {ParsedPattern} next
 * @returns {Promise<GetStreamResults>}
 */

const nestedLoopJoin = async (store: QuadStore, prev: GetStreamResults, next: ParsedPattern): Promise<GetStreamResults> => {

  const nextCommonVarsToTermsMap: { [key: string]: string } = {};

  const nextAdditionalSortingTerms: TQuadstoreTermName[] = [];

  for (const variableName in next.variables) {
    if (next.varsToTermsMap.hasOwnProperty(variableName)) {
      if (prev.variables.hasOwnProperty(variableName)) {
        nextCommonVarsToTermsMap[variableName] = next.varsToTermsMap[variableName];
      } else {
        nextAdditionalSortingTerms.push(variableName);
      }
    }
  }

  const joinedSorting: TQuadstoreTermName[] = [...prev.sorting, ...nextAdditionalSortingTerms];
  const nextSorting = joinedSorting.filter(variableName => next.variables.hasOwnProperty(variableName));

  const getInnerIterator = async (outerBinding: Binding): Promise<ai.AsyncIterator<Binding>> => {
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
    const comparator = QuadStore.prototype._getQuadComparator.call(store, nextSorting);
    return new SortIterator<Binding>(<ai.AsyncIterator<Binding>>iterator, comparator);
  };
  const mergeItems = (firstBinding: Binding, secondBinding: Binding) => ({
    ...firstBinding,
    ...secondBinding,
  });
  return {
    iterator: new NestedLoopJoinIterator<Binding>(prev.iterator, getInnerIterator, mergeItems),
    variables: { ...prev.variables, ...next.variables },
    sorting: joinedSorting,
    type: enums.resultType.BINDINGS,
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

type Pattern = {
  [key: string]: string,
}

/**
 *
 * @param {string[]}termNames
 * @param pattern
 * @returns {ParsedPattern}
 */
const parsePattern = (termNames: string[], pattern: Pattern) => {
  const variables: { [key: string]: true } = {};
  const matchTerms: { [key: string]: string } = {};
  const varsToTermsMap: { [key: string]: string } = {};
  const termsToVarsMap: { [key: string]: string } = {};
  termNames.forEach((termName) => {
    if (pattern[termName]) {
      if (pattern[termName].charAt(0) === '?') {
        variables[pattern[termName]] = true;
        varsToTermsMap[pattern[termName]] = termName;
        termsToVarsMap[termName] = pattern[termName];
      } else {
        matchTerms[termName] = pattern[termName];
      }
    }
  });
  return { variables, matchTerms, termsToVarsMap, varsToTermsMap };
};

type Filter = {
  type: string,
  args: string[],
};

const parseFilter = (termNames: string[], filter: Filter) => {
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


export const searchStream = async (store: QuadStore, patterns: Pattern[], filters: Filter[]) => {

  const termNames = store._getTermNames();

  let parsedFilters = filters.map(filter => parseFilter(termNames, filter));
  let parsedPatterns = patterns.map(pattern => parsePattern(termNames, pattern));

  // parsedFilters.forEach((parsedFilter) => {
  //   parsedPatterns.forEach((parsedPattern) => {
  //     if (objectContains(parsedPattern.variables, parsedFilter.variables)) {
  //       applyFilterToPattern(store, termNames, parsedFilter, parsedPattern);
  //     }
  //   });
  // });

  return await p.reduce(parsedPatterns.slice(1), async (prev: GetStreamResults, next: ParsedPattern): Promise<GetStreamResults> => {
    return await nestedLoopJoin(store, prev, next);
  }, await getBindingsIterator(store, parsedPatterns[0]));

};

