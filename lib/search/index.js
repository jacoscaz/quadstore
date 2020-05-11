
const async = require('async');
const AsyncIterator = require('asynciterator');
const BindingsIterator = require('./domain-iterators/bindings-iterator');
const NestedLoopJoinIterator = require('./generic-iterators/nested-loop-join-iterator');
const _ = require('../utils/lodash');
const enums = require('../utils/enums');
const { DepGraph } = require('dependency-graph');
const masking = require('./masking');
const filtering = require('./filtering');

let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../quadstore');
})






const findCommonVariables = (first, second) => {
  const firstVarTermMappings = {};
  const secondVarTermMappings = {};
  for (const _var of Object.keys(first.variables)) {
    if (second.variables[_var]) {
      firstVarTermMappings[_var] = first.variables[_var];
      secondVarTermMappings[_var] = second.variables[_var];
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
    return getBindingIterator(store, matchTerms, second.variableTerms)
  };
  const mergeItems = (firstbinding, secondBinding) => ({
    ...firstbinding,
    ...secondBinding,
  });
  return {
    ...second,
    iterator: new NestedLoopJoinIterator(first.iterator, getInnerIterator, mergeItems),
    variableMask: masking.getVariableMask(Object.keys({
      ...first.variables,
      ...second.variables,
    })),
  };

};





const TERMS = ['subject', 'predicate', 'object', 'graph'];


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
  return { matchTerms, variableTerms, variables };
}



const searchStream = (store, patterns, filters, cb) => {

  const {
    singleVarFiltersByVariableMask,
    multiVarFiltersByVariableMask,
  } = filtering.parseFilters(filters);

  const depGraph = new DepGraph();




  const bindings = {};
  const descriptors = new Array(patterns.length);
  const iterator = new AsyncIterator.TransformIterator();


  async.eachOfSeries(patterns, (pattern, p, done) => {

    const { variables, variableTerms, matchTerms } = parsePattern(pattern);

    let matchTermsWithFilters = matchTerms;

    for (const [term, variable] of Object.entries(variableTerms)) {
      const filters = singleVarFiltersByVariableMask[variable];
      if (filters) {
        matchTermsWithFilters = filters.reduce((acc, filter) => {
          return {
            ...acc,
            [term]: {
              ...(acc[term] || {}),
              ...filtering.getFilterTermRange(filter),
            } }
        }, matchTermsWithFilters);
      }
    }

    QuadStore.prototype.getApproximateSize.call(store, matchTermsWithFilters, (sizeErr, approximateSize) => {
      if (sizeErr) {
        done(sizeErr);
        return;
      }
      const descriptor = { index: p.toString(), pattern, variables, matchTerms: matchTermsWithFilters, variableTerms, approximateSize };
      depGraph.addNode(descriptor.index, descriptor);
      for (let v = 0, variableNames = Object.keys(variables), variable; v < variableNames.length; v += 1) {
        variable = variableNames[v];
        if (bindings[variable]) {
          if (bindings[variable].approximateSize > approximateSize) {
            depGraph.addDependency(bindings[variable].index, descriptor.index);
            bindings[variable] = descriptor;
          } else {
            depGraph.addDependency(descriptor.index, bindings[variable].index);
          }
        } else {
          bindings[variable] = descriptor;
        }
      }
      descriptors[p] = descriptor;
      done();
    });
  }, (err) => {
    if (err) {
      cb(err);
      return;
    }

    const order = depGraph.overallOrder(false);
    const orderedDescriptors = order.map(index => descriptors[index]);

    const first = orderedDescriptors[0];

    const memo = {
      ...first,
      iterator: getBindingIterator(store, first.matchTerms, first.variableTerms),
      variableMask: masking.getVariableMask(Object.keys(first.variables)),
    };

    return async.reduce(orderedDescriptors.slice(1), memo, (prev, next, done) => {
      const joined = nestedLoopJoin(store, prev, next);
      const filters = multiVarFiltersByVariableMask[joined.variableMask];
      if (filters) {
        for (const filter of filters) {
          joined.iterator = joined.iterator.filter(filtering.compileFilter(filter));
        }
      }
      done(null, joined);

    }, (err, result) => {
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









