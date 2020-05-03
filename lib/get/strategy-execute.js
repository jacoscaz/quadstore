
const _ = require('../utils/lodash');
const AsyncIterator = require('asynciterator');

const generateLevelOpts = (strategy, opts, store) => {
  const levelOpts = {};
  if (strategy.lt.length > 0) {
    if (strategy.lte) {
      levelOpts.lte = strategy.index.name
        + store.separator
        + strategy.lt.join(store.separator)
        + store.separator
        + store.boundary;
    } else {
      levelOpts.lt = strategy.index.name
        + store.separator
        + strategy.lt.join(store.separator)
        + store.separator;
    }
  } else {
    levelOpts.lt = strategy.index.name
      + store.separator
      + store.boundary;
  }
  if (strategy.gt.length > 0) {
    if (strategy.gte) {
      levelOpts.gte = strategy.index.name
        + store.separator
        + strategy.gt.join(store.separator)
        + store.separator;
    } else {
      levelOpts.gt = strategy.index.name
        + store.separator
        + strategy.gt.join(store.separator)
        + store.boundary;
    }
  } else {
    levelOpts.gt = strategy.index.name
      + store.separator;
  }
  return levelOpts;
};

const executeApproximateSize = (strategy, opts, store, cb) => {
  if (!store._db.approximateSize) {
    if (!_.isFunction(cb)) {
      return Promise.resolve(Infinity);
    }
    cb(null, Infinity);
    return;
  }
  const levelOpts = generateLevelOpts(strategy, opts, store);
  const start = levelOpts.gte || levelOpts.gt;
  const end = levelOpts.lte || levelOpts.lt;
  const _count = (cb) => {
    store._db.approximateSize(start, end, (err, count) => {
      if (err) {
        cb(err);
        return;
      }
      cb(err, Math.round(count / 128));
    });
    // TODO: handle opts.limit and opts.offset
  };
  if (!_.isFunction(cb)) {
    return new Promise((resolve, reject) => {
      _count((err, count) => { err ? reject(err) : resolve(count); });
    });
  }
  _count(cb);
};

module.exports.executeApproximateSize = executeApproximateSize;

const execute = (strategy, opts, store) => {
  const levelOpts = generateLevelOpts(strategy, opts, store);
  if (opts.offset) {
    levelOpts.offset = opts.offset;
  }
  if (opts.limit) {
    levelOpts.limit = opts.limit;
  }
  const iterator = AsyncIterator.wrap(store._db.createValueStream(levelOpts));
  executeApproximateSize(strategy, opts, store, (err, approximateCount) => {
    iterator.setProperty('meta', { sorting: strategy.index.terms, approximateCount });
  });
  iterator.setProperty('sorting', strategy.index.terms);
  return iterator;
};

module.exports.execute = execute;
