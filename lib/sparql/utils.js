"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sparqlQuadsToQuad = void 0;
const parsePredicate = (predicate) => {
    if ('type' in predicate) {
        throw new Error('Property paths are not supported');
    }
    return predicate;
};
const graphTripleToQuad = (store, triple, graph) => {
    return store.dataFactory.quad(triple.subject, parsePredicate(triple.predicate), triple.object, graph);
};
const bgpTripleToQuad = (store, triple) => {
    return store.dataFactory.quad(triple.subject, parsePredicate(triple.predicate), triple.object, store.dataFactory.defaultGraph());
};
exports.sparqlQuadsToQuad = (store, pattern, binding = {}) => {
    const quads = [];
    switch (pattern.type) {
        case 'bgp':
            const bgpPattern = pattern;
            quads.push(...bgpPattern.triples.map(triple => bgpTripleToQuad(store, triple)));
            break;
        case 'graph':
            const graphPattern = pattern;
            quads.push(...graphPattern.triples.map(triple => graphTripleToQuad(store, triple, graphPattern.name)));
            break;
        default:
            // @ts-ignore
            throw new Error(`Unsupported SPARQL pattern type "${pattern.type}`);
    }
    return quads.map(quad => replaceBindingInPattern(quad, binding));
};
//# sourceMappingURL=utils.js.map