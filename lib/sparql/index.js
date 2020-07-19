"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sparqlStream = exports.parse = void 0;
const sparqljs_1 = require("sparqljs");
const update_1 = require("./update");
const query_1 = require("./query");
const sparqlParser = new sparqljs_1.Parser();
exports.parse = (query) => {
    return sparqlParser.parse(query);
};
exports.sparqlStream = async (store, query, opts) => {
    const parsed = exports.parse(query);
    switch (parsed.type) {
        case 'query':
            return await query_1.handleSparqlQuery(store, parsed, opts);
        case 'update':
            return await update_1.handleSparqlUpdate(store, parsed, opts);
        default:
            // @ts-ignore
            throw new Error(`Unsupported SPARQL type "${parsed.type}"`);
    }
};
//# sourceMappingURL=index.js.map