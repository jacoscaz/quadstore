
const async = require('async');
const AsyncIterator = require('asynciterator');
const BindingsIterator = require('./domain-iterators/bindings-iterator');
const NestedLoopJoinIterator = require('./generic-iterators/nested-loop-join-iterator');
const _ = require('../utils/lodash');
const enums = require('../utils/enums');
const assert = require('assert');

let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../quadstore');
})

const TERMS = ['subject', 'predicate', 'object', 'graph'];

const compileGtFilter = (parsedFilter) => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding) => binding[parsedFilter.filter.args[0]] > parsedFilter.filter.args[1];
  }
  if (variableCount === 2) {
    return (binding) => binding[parsedFilter.filter.args[0]] > binding[parsedFilter.filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.filter.type}"`);
};

const compileGteFilter = (parsedFilter) => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding) => binding[parsedFilter.filter.args[0]] >= parsedFilter.filter.args[1];
  }
  if (variableCount === 2) {
    return (binding) => binding[parsedFilter.filter.args[0]] >= binding[parsedFilter.filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.filter.type}"`);
};

const compileLtFilter = (parsedFilter) => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding) => binding[parsedFilter.filter.args[0]] < parsedFilter.filter.args[1];
  }
  if (variableCount === 2) {
    return (binding) => binding[parsedFilter.filter.args[0]] < binding[parsedFilter.filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.filter.type}"`);
};

const compileLteFilter = (parsedFilter) => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding) => binding[parsedFilter.filter.args[0]] <= parsedFilter.filter.args[1];
  }
  if (variableCount === 2) {
    return (binding) => binding[parsedFilter.filter.args[0]] <= binding[parsedFilter.filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.filter.type}"`);
};

const compileFilter = (parsedFilter) => {
  switch (parsedFilter.filter.type) {
    case enums.filterType.GT:
      return compileGtFilter(parsedFilter);
    case enums.filterType.GTE:
      return compileGteFilter(parsedFilter);
    case enums.filterType.LT:
      return compileLtFilter(parsedFilter);
    case enums.filterType.LTE:
      return compileLteFilter(parsedFilter);
    default:
      throw new Error(`Unsupported filter type "${parsedFilter.type}"`);
  }
};


const getFilterTermRange = (parsedFilter) => {
  switch (parsedFilter.filter.type) {
    case enums.filterType.LT:
      return { lt: parsedFilter.filter.args[1] };
    case enums.filterType.LTE:
      return { lte: parsedFilter.filter.args[1] };
    case enums.filterType.GT:
      return { gt: parsedFilter.filter.args[1] };
    case enums.filterType.GTE:
      return { gte: parsedFilter.filter.args[1] };
    default:
      return null;
  }
};

const mergeFilterTermRanges = (a, b) => {
  const c = {...b};
  if (a.lt !== undefined) {
    if (c.lt !== undefined) {
      if (a.lt < c.lt) {
        c.lt = a.lt;
      }
    } else {
      c.lt = a.lt;
    }
  }
  if (a.lte !== undefined) {
    if (c.lte !== undefined) {
      if (a.lte < c.lte) {
        c.lte = a.lte;
      }
    } else {
      c.lte = a.lte;
    }
  }
  if (a.gt !== undefined) {
    if (c.gt !== undefined) {
      if (a.gt > c.gt) {
        c.gt = a.gt;
      }
    } else {
      c.gt = a.gt;
    }
  }
  if (a.gte !== undefined) {
    if (c.gte !== undefined) {
      if (a.gte > c.gte) {
        c.gte = a.gte;
      }
    } else {
      c.gte = a.gte;
    }
  }
}

const mergeMatchTerms = (a, b) => {
  const c = { ...b };
  TERMS.forEach((termName) => {
    if (c[termName] === undefined) {
      if (a[termName] !== undefined) {
        c[termName] = a[termName];
      }
    } else {
      if (a[termName] !== undefined) {
        if (typeof(a[termName]) === 'object' && typeof(c[termName]) === 'object') {
          c[termName] = mergeFilterTermRanges(a[termName], c[termName]);
        } else {
          throw new Error(`Cannot merge match terms`);
        }
      }
    }
  });
  return c;
};

const findCommonVariables = (first, second) => {
  const firstVarTermMappings = {};
  const secondVarTermMappings = {};
  for (const variableName of Object.keys(first.variables)) {
    if (second.variables[variableName]) {
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

const parsePattern = (pattern) => {
  const variables = {};
  const matchTerms = {};
  const variableTerms = {};
  for (let t = 0, term; t < TERMS.length; t += 1) {
    term = TERMS[t];
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

const parseFilter = (filter) => {
  const variables = {};
  for (const arg of filter.args) {
    if (arg.charAt(0) === '?') {
      variables[arg] = true;
    }
  }
  return { filter, variables };
};

const applyFilterToPattern = (parsedFilter, parsedPattern) => {
  const variableNames = Object.keys(parsedFilter.variables);
  if (variableNames.length === 1) {
    const matchTerms = {
      [parsedPattern.variables[variableNames[0]]]: getFilterTermRange(parsedFilter),
    };
    parsedPattern.filterMatchTerms = mergeMatchTerms(parsedPattern.filterMatchTerms, matchTerms);
  }
  const filterFn = compileFilter(parsedFilter);
  parsedPattern.filterFns.push(filterFn);
  return parsedPattern;
};


const searchStream = (store, patterns, filters, cb) => {

  const parsedFilters = filters.map(parseFilter);
  const parsedPatterns = patterns.map(parsePattern);

  parsedFilters.forEach((parsedFilter) => {
    parsedPatterns.forEach((parsedPattern) => {
      if (objectContains(parsedPattern.variables, parsedFilter.variables)) {
        applyFilterToPattern(parsedFilter, parsedPattern);
      }
    });
  });

  const mapper = (parsedPattern, done) => {
    QuadStore.prototype.getApproximateSize.call(store, parsedPattern.filterMatchTerms, (err, approximateSize) => {
      if (err) {
        QuadStore.prototype.getApproximateSize.call(store, parsedPattern.matchTerms, (err, approximateSize) => {
          if (err) {
            done(err);
            return;
          }
          done(null, Object.assign(parsedPattern, { approximateSize }));
        });
        return;
      }
      done(null, Object.assign(parsedPattern, { approximateSize }));
    });
  };

  const iterator = new AsyncIterator.TransformIterator();

  async.map(parsedPatterns, mapper, (err, parsedPatterns) => {

    if (err) {
      cb(err);
      return;
    }

    const sorter = (pa, pb) => {
      return pa.approximateSize - pb.approximateSize;
    };

    parsedPatterns.sort(sorter);

    const reducer = (prev, next, done) => {
      const joined = nestedLoopJoin(store, prev, next);
      done(null, joined);
    };

    return async.reduce(parsedPatterns, getInitialQueryCtx(), reducer, (err, result) => {
      if (err) {
        console.log('EXECUTION ERROR', err);
        throw err;
      }
      iterator.source = result.iterator;
    });

  });

  return iterator;


};

module.exports.searchStream = searchStream;









