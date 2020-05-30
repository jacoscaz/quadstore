"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { execute, executeApproximateSize } = require('./strategy-execute');
const { generate } = require('./strategy-generate');
const enums = require('../utils/enums');
const getStream = async (store, query, opts) => {
    const strategy = generate(store, query);
    const iterator = await execute(store, strategy, opts);
    return { type: enums.resultType.QUADS, iterator, sorting: strategy.index.terms };
};
module.exports.getStream = getStream;
const getApproximateSize = async (store, query, opts) => {
    const strategy = generate(store, query);
    const approximateSize = await executeApproximateSize(store, strategy, opts);
    return { type: enums.resultType.APPROX_SIZE, approximateSize, sorting: strategy.index.terms };
};
module.exports.getApproximateSize = getApproximateSize;
