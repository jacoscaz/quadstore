"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require('../utils/lodash');
const AsyncIterator = require('asynciterator');
const generateLevelOpts = (store, strategy, opts) => {
    const levelOpts = {};
    if (strategy.lt.length > 0) {
        if (strategy.lte) {
            levelOpts.lte = strategy.index.name
                + store.separator
                + strategy.lt.join(store.separator)
                + store.separator
                + store.boundary;
        }
        else {
            levelOpts.lt = strategy.index.name
                + store.separator
                + strategy.lt.join(store.separator)
                + store.separator;
        }
    }
    else {
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
        }
        else {
            levelOpts.gt = strategy.index.name
                + store.separator
                + strategy.gt.join(store.separator)
                + store.boundary;
        }
    }
    else {
        levelOpts.gt = strategy.index.name
            + store.separator;
    }
    return levelOpts;
};
const executeApproximateSize = async (store, strategy, opts) => {
    if (!store.db.approximateSize) {
        return Infinity;
    }
    const levelOpts = generateLevelOpts(store, strategy, opts);
    const start = levelOpts.gte || levelOpts.gt;
    const end = levelOpts.lte || levelOpts.lt;
    return new Promise((resolve, reject) => {
        store.db.approximateSize(start, end, (err, size) => {
            err ? reject(err) : resolve(size);
        });
    });
};
module.exports.executeApproximateSize = executeApproximateSize;
const execute = async (store, strategy, opts) => {
    const levelOpts = generateLevelOpts(store, strategy, opts);
    if (opts.offset) {
        levelOpts.offset = opts.offset;
    }
    if (opts.limit) {
        levelOpts.limit = opts.limit;
    }
    const iterator = AsyncIterator.wrap(store.db.createValueStream(levelOpts));
    return iterator;
};
module.exports.execute = execute;
//# sourceMappingURL=strategy-execute.js.map