
const _ = require('../utils/lodash');
const p = require('p-iteration');
const async = require('async');
const enums = require('../utils/enums');
const assert = require('assert');
const filtering = require('./filtering');
const AsyncIterator = require('asynciterator');
const BindingsIterator = require('./domain-iterators/bindings-iterator');
const NestedLoopJoinIterator = require('./generic-iterators/nested-loop-join-iterator');

let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../quadstore');
});



const findCommonVariables = (first, second) => {
  const firstVarTermMappings = {};
  const secondVarTermMappings = {};
  for (const variableName in first.variables) {
    if (first.variables.hasOwnProperty(variableName) && second.variables.hasOwnProperty(variableName)) {
      firstVarTermMappings[variableName] = first.variables[variableName];
      secondVarTermMappings[variableName] = second.variables[variableName];
    }
  }
  return [firstVarTermMappings, secondVarTermMappings];
};

const getBindingIterator = (store, matchTerms, termToVariableMappings) => {
  return new BindingsIterator(store, matchTerms, termToVariableMappings);
};


const nestedLoopJoin = (store, first, second) => {
  const [fm, sm] = findCommonVariables(first, second);
  const getInnerIterator = (firstBinding) => {
    const matchTerms = {...second.matchTerms};
    for (const _v in sm) {
      matchTerms[sm[_v]] = firstBinding[_v];
    }
    let iterator = getBindingIterator(store, matchTerms, second.variableTerms);
    for (const filterFn of second.filterFns) {
      iterator = iterator.filter(filterFn);
    }
    return iterator;
  };
  const mergeItems = (firstBinding, secondBinding) => ({
    ...firstBinding,
    ...secondBinding,
  });
  return {
    ...second,
    iterator: new NestedLoopJoinIterator(first.iterator, getInnerIterator, mergeItems),
    variables: { ...first.variables, ...second.variables },
    variableTerms: { ...first.variableTerms, ...second.variableTerms },
    filters: [],
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
  const variableTerms = {};
  for (let t = 0, term; t < termNames.length; t += 1) {
    term = termNames[t];
    if (pattern[term]) {
      if (pattern[term].charAt(0) === '?') {
        variables[pattern[term]] = term;
        variableTerms[term] = pattern[term];
      } else {
        matchTerms[term] = pattern[term];
      }
    }
  }
  return {
    pattern,
    matchTerms,
    filterMatchTerms: {...matchTerms},
    variableTerms,
    variables,
    filterFns: [],
  };
};

const getInitialQueryCtx = () => {
  return {
    filterFns: [],
    variables: {},
    matchTerms: {},
    filterMatchTerms: {},
    variableTerms: {},
    iterator: new AsyncIterator.ArrayIterator([{}]),
  };
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

  parsedFilters.forEach((parsedFilter) => {
    parsedPatterns.forEach((parsedPattern) => {
      if (objectContains(parsedPattern.variables, parsedFilter.variables)) {
        applyFilterToPattern(store, termNames, parsedFilter, parsedPattern);
      }
    });
  });

  const mapper = async (parsedPattern) => {
    let approximateSize;
    try {
      approximateSize = await QuadStore.prototype.getApproximateSize.call(store, parsedPattern.filterMatchTerms);
    } catch (err) {
      approximateSize = await QuadStore.prototype.getApproximateSize.call(store, parsedPattern.matchTerms);
    }
    return Object.assign(parsedPattern, { approximateSize });
  };

  parsedPatterns = await p.map(parsedPatterns, mapper);

  const sorter = (pa, pb) => {
    return pa.approximateSize - pb.approximateSize;
  };

  parsedPatterns.sort(sorter);

  const result = await p.reduce(parsedPatterns, async (prev, next) => {
    return nestedLoopJoin(store, prev, next);
  }, getInitialQueryCtx());

  result.iterator.type = enums.resultType;

  return { type: enums.resultType.BINDINGS, iterator: result.iterator, variables: Object.keys(result.variables) };
};

module.exports.searchStream = searchStream;
