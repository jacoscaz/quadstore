"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSparqlSelect = void 0;
const parseSparqlFilter = (whereGroup) => {
    if (whereGroup.type !== 'filter') {
        throw new Error(`Not a filter`);
    }
    if (!('type' in whereGroup.expression)) {
        throw new Error(`Unsupported where expression`);
    }
    if (whereGroup.expression.type !== 'operation') {
        throw new Error(`Unsupported filter expression type "${whereGroup.expression.type}"`);
    }
    switch (whereGroup.expression.operator) {
        case '<': // @ts-ignore
            return { type: "lt" /* LT */, args: whereGroup.expression.args };
        case '<=': // @ts-ignore
            return { type: "lte" /* LTE */, args: whereGroup.expression.args };
        case '>': // @ts-ignore
            return { type: "gt" /* GT */, args: whereGroup.expression.args };
        case '>=': // @ts-ignore
            return { type: "gte" /* GTE */, args: whereGroup.expression.args };
        default:
            throw new Error(`Unsupported filter operator "${whereGroup.expression.operator}"`);
    }
};
const sparqlBgpPatternToStages = (pattern, graph) => {
    return pattern.triples.map(triple => ({
        type: "bgp" /* BGP */,
        pattern: { ...triple, graph },
        optional: false,
    }));
};
exports.handleSparqlSelect = async (store, parsed, opts) => {
    const stages = []; // TODO: pipeline
    if (parsed.where) {
        parsed.where.forEach((pattern) => {
            switch (pattern.type) {
                case 'graph':
                    const graphPattern = pattern;
                    pattern.patterns.forEach((innerPattern) => {
                        switch (innerPattern.type) {
                            case 'bgp':
                                stages.push(...sparqlBgpPatternToStages(innerPattern, graphPattern.name));
                                break;
                            default:
                                throw new Error(`Unsupported WHERE group pattern type "${innerPattern.type}"`);
                        }
                    });
                    break;
                case 'bgp':
                    stages.push(...sparqlBgpPatternToStages(pattern));
                    break;
                case 'filter':
                    stages.push(parseSparqlFilter(pattern));
                    break;
                default:
                    throw new Error(`Unsupported WHERE group type "${pattern.type}"`);
            }
        });
    }
    const results = (await store.searchStream(stages, opts));
    return results;
};
//# sourceMappingURL=select.js.map