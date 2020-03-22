
const { execute, executeApproximateCount } = require('./strategy-execute');
const { generate } = require('./strategy-generate');

const getStream = (query, opts, store) => {
  const strategy = generate(query, store);
  return execute(strategy, opts, store);
};

module.exports.getStream = getStream;

const getApproximateCount = (query, opts, store) => {
  const strategy = generate(query, store);
  return executeApproximateCount(strategy, opts, store);
};

module.exports.getApproximateCount = getApproximateCount;

