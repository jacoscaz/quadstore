
const { execute, executeApproximateSize } = require('./strategy-execute');
const { generate } = require('./strategy-generate');

const getStream = (query, opts, store) => {
  const strategy = generate(query, store);
  return execute(strategy, opts, store);
};

module.exports.getStream = getStream;

const getApproximateSize = (query, opts, store, cb) => {
  const strategy = generate(query, store);
  return executeApproximateSize(strategy, opts, store, cb);
};

module.exports.getApproximateSize = getApproximateSize;

