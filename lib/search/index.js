
const _ = require('../utils/lodash');
const p = require('p-iteration');
const enums = require('../utils/enums');
const filtering = require('./filtering');
const SortIterator = require('./iterators/sort-iterator');
const NestedLoopJoinIterator = require('./iterators/nested-loop-join-iterator');

let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../quadstore');
});

/**
 * @typedef {object} GetStreamResults
 * @property {AsyncIterator} iterator
 * @property {object} variables
 * @property {string[]} sorting
 * @property {string} type
 */

/**
 * @typedef {object} ParsedPattern
 * @property {object} variables
 * @property {object} matchTerms
 * @property {object} termsToVarsMap
 * @property {object} varsToTermsMap
 */

/**
 *
 * @param {object} store
 * @param {ParsedPattern} parsedPattern
 * @returns {Promise<GetStreamResults>}
 */

const getBindingsIterator = async (store, parsedPattern) => {
  const {variables, matchTerms, termsToVarsMap} = parsedPattern;
  const results = await QuadStore.prototype.getStream.call(store, matchTerms);
  const sorting = results.sorting.reduce((acc, termName) => {
    if (termsToVarsMap[termName]) {
      acc.push(termsToVarsMap[termName]);
    }
    return acc;
  }, []);
  let iterator = results.iterator.transform(function (quad, done) {
    const binding = {};
    for (const term in termsToVarsMap) {
      if (termsToVarsMap.hasOwnProperty(term)) {
        binding[termsToVarsMap[term]] = quad[term];
      }
    }
    this._push(binding);
    done();
  });
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

const nestedLoopJoin = async (store, prev, next) => {

  const nextCommonVarsToTermsMap = {};

  const nextAdditionalSortingTerms = [];

  for (const variableName in next.variables) {
    if (next.varsToTermsMap.hasOwnProperty(variableName)) {
      if (prev.variables.hasOwnProperty(variableName)) {
        nextCommonVarsToTermsMap[variableName] = next.varsToTermsMap[variableName];
      } else {
        nextAdditionalSortingTerms.push(variableName);
      }
    }
  }

  const joinedSorting = [...prev.sorting, ...nextAdditionalSortingTerms];
  const nextSorting = joinedSorting.filter(variableName => next.variables.hasOwnProperty(variableName));

  const getInnerIterator = async (outerBinding) => {
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
    return new SortIterator(iterator, comparator);
  };
  const mergeItems = (firstBinding, secondBinding) => ({
    ...firstBinding,
    ...secondBinding,
  });
  return {
    iterator: new NestedLoopJoinIterator(prev.iterator, getInnerIterator, mergeItems),
    variables: { ...prev.variables, ...next.variables },
    sorting: joinedSorting,
    type: enums.resultType.BINDINGS,
  };
};

const objectContains = (outer, inner) => {
  for (const key in inner) {
    if (inner.hasOwnProperty(key)) {
      if (!outer.hasOwnProperty(key)) {
        return false;
      }
    }
  }
  return true;
};

const parsePattern = (termNames, pattern) => {
  const variables = {};
  const matchTerms = {};
  const varsToTermsMap = {};
  const termsToVarsMap = {};
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


const parseFilter = (termNames, filter) => {
  const variables = {};
  for (const arg of filter.args) {
    if (arg.charAt(0) === '?') {
      variables[arg] = true;
    }
  }
  return { ...filter, variables };
};

const applyFilterToPattern = (store, termNames, parsedFilter, parsedPattern) => {
  const variableNames = Object.keys(parsedFilter.variables);
  if (variableNames.length === 1) {
    const matchTerms = {
      [parsedPattern.variables[variableNames[0]]]: filtering.getFilterTermRange(parsedFilter),
    };
    parsedPattern.filterMatchTerms = store._mergeMatchTerms(parsedPattern.filterMatchTerms, matchTerms, termNames);
  }
  const filterFn = filtering.compileFilter(parsedFilter);
  parsedPattern.filterFns.push(filterFn);
  return parsedPattern;
};


const searchStream = async (store, patterns, filters) => {

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

  return await p.reduce(parsedPatterns.slice(1), async (prev, next) => {
    return await nestedLoopJoin(store, prev, next);
  }, await getBindingsIterator(store, parsedPatterns[0]));

};

module.exports.searchStream = searchStream;
