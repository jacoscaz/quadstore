
const { execute, executeApproximateSize } = require('./strategy-execute');
const { generate } = require('./strategy-generate');

const getStream = async (store, query, opts) => {
  const strategy = generate(store, query);
  return await execute(store, strategy, opts);
};

module.exports.getStream = getStream;

const getApproximateSize = async (store, query, opts) => {
  const strategy = generate(store, query);
  return await executeApproximateSize(store, strategy, opts);
};

module.exports.getApproximateSize = getApproximateSize;

