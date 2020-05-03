
const async = require('async');
const { DepGraph } = require('dependency-graph');

let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../quadstore');
})

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

const plan = (store, patterns, filters, cb) => {
  const depGraph = new DepGraph();
  const bindings = {};
  const descriptors = new Array(patterns.length);
  async.eachOfSeries(patterns, (pattern, p, done) => {
    const { variables, variableTerms, matchTerms } = parsePattern(pattern);
    QuadStore.prototype.getApproximateSize.call(store, matchTerms, (sizeErr, approximateSize) => {
      if (sizeErr) {
        done(sizeErr);
        return;
      }
      const descriptor = { index: p.toString(), pattern, variables, matchTerms, variableTerms, approximateSize };
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
    cb(null, { descriptors, order: depGraph.overallOrder(false)  });
  });
};

module.exports.plan = plan;
