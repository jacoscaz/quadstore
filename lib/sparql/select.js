"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSparqlSelect = void 0;
const types_1 = require("../types");
const enums = require('../utils/enums');
const parseSparqlFilter = (whereGroup) => {
    if (whereGroup.type !== 'filter') {
        throw new Error(`Not a filter`);
    }
    if (whereGroup.expression.type !== 'operation') {
        throw new Error(`Unsupported filter expression type "${whereGroup.expression.type}"`);
    }
    switch (whereGroup.expression.operator) {
        case '<':
            return { type: enums.filterType.LT, args: whereGroup.expression.args };
        case '<=':
            return { type: enums.filterType.LTE, args: whereGroup.expression.args };
        case '>':
            return { type: enums.filterType.GT, args: whereGroup.expression.args };
        case '>=':
            return { type: enums.filterType.GTE, args: whereGroup.expression.args };
        default:
            throw new Error(`Unsupported filter operator "${whereGroup.expression.operator}"`);
    }
};
exports.handleSparqlSelect = async (store, parsed, opts) => {
    const stages = []; // TODO: pipeline
    parsed.where.forEach((whereGroup) => {
        switch (whereGroup.type) {
            case 'graph':
                whereGroup.patterns.forEach((whereGroupPattern) => {
                    switch (whereGroupPattern.type) {
                        case 'bgp':
                            whereGroupPattern.triples.forEach(triple => {
                                stages.push({
                                    type: types_1.TSSearchStageType.BGP,
                                    pattern: { ...triple, graph: whereGroup.name },
                                });
                            });
                            break;
                        default:
                            throw new Error(`Unsupported WHERE group pattern type "${whereGroupPattern.type}"`);
                    }
                });
                break;
            case 'bgp':
                whereGroup.triples.forEach(triple => { patterns.push(triple); });
                break;
            case 'filter':
                filters.push(parseSparqlFilter(whereGroup));
                break;
            default:
                throw new Error(`Unsupported WHERE group type "${whereGroup.type}"`);
        }
    });
    const results = await store.searchStream(stages, opts);
    return results;
};
