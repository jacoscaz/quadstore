
const async = require('async');
const AsyncIterator = require('asynciterator');
const BindingsIterator = require('./domain-iterators/bindings-iterator');
const NestedLoopJoinIterator = require('./generic-iterators/nested-loop-join-iterator');
const planner = require('./planner');



// const createComparator = (terms) => {
//   return (a, b) => {
//     for (let t = 0, term; t < terms.length; t += 1) {
//       term = terms[0];
//       if (a[term] < b[term]) return -1;
//       if (a[term] > b[term]) return +1;
//     }
//     return 0;
//   };
// };
// module.exports = createComparator;


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
  const mergeItems = (firstbinding, secondBinding) => ({ ...firstbinding, ...secondBinding });
  return { ...second, iterator: new NestedLoopJoinIterator(first.iterator, getInnerIterator, mergeItems) };

};





const execute = (store, descriptors, order, cb) => {
  const first = descriptors[0];
  const memo = { ...first, iterator: getBindingIterator(store, first.matchTerms, first.variableTerms) };
  return async.reduce(descriptors.slice(1), memo, (prev, next, done) => {
    done(null, nestedLoopJoin(store, prev, next));
  }, cb);
};

const searchStream = (store, patterns, filters, opts) => {

  const iterator = new AsyncIterator.TransformIterator();

  planner.plan(store, patterns, filters, (err, results) => {
    const { descriptors, order } = results;
    console.log('PLANNED', descriptors, order);
    execute(store, descriptors, order, (err, result) => {
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













//
// const exec = order.reduce((acc, index) => {
//
//   const descriptor = descriptors[index];
//
//   const { matchTerms } = descriptor;
//
//   if (acc === null) {
//     return { descriptor, iterator: store.getStream(matchTerms) };
//   }
//
//   const { descriptor: previousDescriptor, iterator: previousIterator } = acc;
//
//   previousDescriptor.getProperty('meta', (meta) => {
//
//   });
//
//
//
//   descriptor.variables
//
//   acc.push(descriptor.variableTerms);
//   return acc;
// }, null)



