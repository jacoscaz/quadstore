"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterTermRange = exports.compileFilter = void 0;
const { filterType } = require('../utils/enums');
const compileGtFilter = (stage) => {
    const variableCount = Object.keys(stage.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[stage.args[0]] > stage.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[stage.args[0]] > binding[stage.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};
const compileGteFilter = (stage) => {
    const variableCount = Object.keys(stage.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[stage.args[0]] >= stage.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[stage.args[0]] >= binding[stage.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};
const compileLtFilter = (stage) => {
    const variableCount = Object.keys(stage.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[stage.args[0]] < stage.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[stage.args[0]] < binding[stage.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};
const compileLteFilter = (stage) => {
    const variableCount = Object.keys(stage.variables).length;
    if (variableCount === 1) {
        return (binding) => binding[stage.args[0]] <= stage.args[1];
    }
    if (variableCount === 2) {
        return (binding) => binding[stage.args[0]] <= binding[stage.args[1]];
    }
    throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};
exports.compileFilter = (stage) => {
    switch (stage.type) {
        case filterType.GT:
            return compileGtFilter(stage);
        case filterType.GTE:
            return compileGteFilter(stage);
        case filterType.LT:
            return compileLtFilter(stage);
        case filterType.LTE:
            return compileLteFilter(stage);
        default:
            throw new Error(`Unsupported filter type "${stage.type}"`);
    }
};
exports.getFilterTermRange = (stage) => {
    switch (stage.type) {
        case filterType.LT:
            return { lt: stage.args[1] };
        case filterType.LTE:
            return { lte: stage.args[1] };
        case filterType.GT:
            return { gt: stage.args[1] };
        case filterType.GTE:
            return { gte: stage.args[1] };
        default:
            return null;
    }
};
module.exports.getFilterTermRange = exports.getFilterTermRange;
//# sourceMappingURL=filtering.js.map