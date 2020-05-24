"use strict";
const enums = require('../utils/enums');
const compileGtFilter = (parsedFilter) => {
    const variableCount = Object.keys(parsedFilter.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[parsedFilter.args[0]] > parsedFilter.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[parsedFilter.args[0]] > binding[parsedFilter.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};
const compileGteFilter = (parsedFilter) => {
    const variableCount = Object.keys(parsedFilter.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[parsedFilter.args[0]] >= parsedFilter.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[parsedFilter.args[0]] >= binding[parsedFilter.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};
const compileLtFilter = (parsedFilter) => {
    const variableCount = Object.keys(parsedFilter.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[parsedFilter.args[0]] < parsedFilter.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[parsedFilter.args[0]] < binding[parsedFilter.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};
const compileLteFilter = (parsedFilter) => {
    const variableCount = Object.keys(parsedFilter.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[parsedFilter.args[0]] <= parsedFilter.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[parsedFilter.args[0]] <= binding[parsedFilter.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};
const compileFilter = (parsedFilter) => {
    switch (parsedFilter.type) {
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
module.exports.compileFilter = compileFilter;
const getFilterTermRange = (parsedFilter) => {
    switch (parsedFilter.type) {
        case enums.filterType.LT:
            return { lt: parsedFilter.args[1] };
        case enums.filterType.LTE:
            return { lte: parsedFilter.args[1] };
        case enums.filterType.GT:
            return { gt: parsedFilter.args[1] };
        case enums.filterType.GTE:
            return { gte: parsedFilter.args[1] };
        default:
            return null;
    }
};
module.exports.getFilterTermRange = getFilterTermRange;
