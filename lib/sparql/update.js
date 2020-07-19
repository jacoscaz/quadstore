"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSparqlUpdate = void 0;
const asynciterator_1 = __importDefault(require("asynciterator"));
const utils_1 = require("../utils");
const select = __importStar(require("./select"));
const parseSubject = (subject) => {
    if (subject.termType === 'Literal') {
        throw new Error('Literals not supported');
    }
    return subject;
};
const parsePredicate = (predicate) => {
    if ('type' in predicate) {
        throw new Error('Property paths are not supported');
    }
    if (predicate.termType === 'Literal') {
        throw new Error('Literals not supported');
    }
    if (predicate.termType === 'BlankNode') {
        throw new Error('Blank nodes not supported');
    }
    return predicate;
};
const graphTripleToQuad = (store, triple, graph) => {
    return store.dataFactory.quad(parseSubject(triple.subject), parsePredicate(triple.predicate), triple.object, graph);
};
const bgpTripleToQuad = (store, triple) => {
    return store.dataFactory.quad(parseSubject(triple.subject), parsePredicate(triple.predicate), triple.object, store.dataFactory.defaultGraph());
};
const handleSparqlInsert = async (store, update, opts) => {
    const quads = [];
    if ('insert' in update && Array.isArray(update.insert)) {
        update.insert.forEach((sparqlQuadPattern) => {
            switch (sparqlQuadPattern.type) {
                case 'bgp':
                    quads.push(...sparqlQuadPattern.triples.map(triple => bgpTripleToQuad(store, triple)));
                    break;
                case 'graph':
                    quads.push(...sparqlQuadPattern.triples.map(triple => graphTripleToQuad(store, triple, sparqlQuadPattern.name)));
                    break;
                default:
                    // @ts-ignore
                    throw new Error(`Unsupported SPARQL insert group type "${sparqlQuadPattern.type}"`);
            }
        });
    }
    const iterator = new asynciterator_1.default.ArrayIterator(quads).transform({
        transform(quad, done) {
            store.put([quad])
                .then(done.bind(null, null))
                .catch(done);
        },
    });
    await utils_1.waitForEvent(iterator, 'end', true);
    return { type: "void" /* VOID */ };
};
const handleSparqlDelete = async (store, update, opts) => {
    const quads = [];
    if ('delete' in update && Array.isArray(update.delete)) {
        update.delete.forEach((sparqlQuadPattern) => {
            switch (sparqlQuadPattern.type) {
                case 'bgp':
                    quads.push(...sparqlQuadPattern.triples.map(triple => bgpTripleToQuad(store, triple)));
                    break;
                case 'graph':
                    quads.push(...sparqlQuadPattern.triples.map(triple => graphTripleToQuad(store, triple, sparqlQuadPattern.name)));
                    break;
                default:
                    // @ts-ignore
                    throw new Error(`Unsupported SPARQL insert group type "${sparqlQuadPattern.type}"`);
            }
        });
    }
    const iterator = new asynciterator_1.default.ArrayIterator(quads).transform({
        transform(quad, done) {
            store.del([quad], {})
                .then(done.bind(null, null))
                .catch(done);
        },
    });
    await utils_1.waitForEvent(iterator, 'end', true);
    return { type: "void" /* VOID */ };
};
const replaceBindingInPattern = (quad, binding) => {
    const p = { ...quad };
    utils_1.termNames.forEach((termName) => {
        const term = p[termName];
        if (term.termType !== 'Variable') {
            return;
        }
        const bindingValue = binding[`?${term.value}`];
        if (!bindingValue) {
            return;
        }
        switch (termName) {
            case 'subject':
                if (bindingValue.termType === 'Literal') {
                    throw new Error('Invalid');
                }
                if (bindingValue.termType === 'DefaultGraph') {
                    throw new Error('Invalid');
                }
                p[termName] = bindingValue;
                break;
            case 'predicate':
                if (bindingValue.termType === 'DefaultGraph') {
                    throw new Error('Invalid');
                }
                if (bindingValue.termType === 'BlankNode') {
                    throw new Error('Invalid');
                }
                if (bindingValue.termType === 'Literal') {
                    throw new Error('Invalid');
                }
                p[termName] = bindingValue;
                break;
            case 'object':
                if (bindingValue.termType === 'DefaultGraph') {
                    throw new Error('Invalid');
                }
                p[termName] = bindingValue;
                break;
            case 'graph':
                if (bindingValue.termType === 'Literal') {
                    throw new Error('Invalid');
                }
                p[termName] = bindingValue;
                break;
            default:
                throw new Error(`Unexpected term "${termName}"`);
        }
    });
    return p;
};
const sparqlPatternToQuads = (store, pattern, binding = {}) => {
    const quads = [];
    switch (pattern.type) {
        case 'bgp':
            quads.push(...pattern.triples.map(triple => bgpTripleToQuad(store, triple)));
            break;
        case 'graph':
            quads.push(...pattern.triples.map(triple => graphTripleToQuad(store, triple, pattern.name)));
            break;
        default:
            // @ts-ignore
            throw new Error(`Unsupported SPARQL pattern type "${pattern.type}`);
    }
    return quads.map(quad => replaceBindingInPattern(quad, binding));
};
const handleSparqlInsertDelete = async (store, update, opts) => {
    const results = await select.handleSparqlSelect(store, { where: update.where }, opts);
    const iterator = results.iterator.transform({
        transform: (binding, done) => {
            const deleteQuads = [];
            const insertQuads = [];
            if (update.delete) {
                update.delete.forEach((pattern) => {
                    deleteQuads.push(...sparqlPatternToQuads(store, pattern, binding));
                });
            }
            if (update.insert) {
                update.insert.forEach((pattern) => {
                    insertQuads.push(...sparqlPatternToQuads(store, pattern, binding));
                });
            }
            store.patch(deleteQuads, insertQuads, {})
                .then(done.bind(null, null))
                .catch(done);
        },
    });
    await utils_1.waitForEvent(iterator, 'end', true);
    return { type: "void" /* VOID */ };
};
exports.handleSparqlUpdate = async (store, parsed, opts) => {
    const { updates } = parsed;
    if (updates.length > 1) {
        throw new Error(`Unsupported number of update groups in query (> 1)`);
    }
    const update = updates[0];
    if (!('updateType' in update)) {
        throw new Error(`Unsupported SPARQL update`);
    }
    switch (update.updateType) {
        case 'insert':
            return await handleSparqlInsert(store, update, opts);
        case 'delete':
            return await handleSparqlDelete(store, update, opts);
        case 'insertdelete':
            return await handleSparqlInsertDelete(store, update, opts);
        default:
            throw new Error(`Unsupported SPARQL update type "${update.updateType}"`);
    }
};
module.exports.handleSparqlUpdate = exports.handleSparqlUpdate;
//# sourceMappingURL=update.js.map