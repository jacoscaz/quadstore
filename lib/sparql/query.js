"use strict";
const select = require('./select');
const handleSparqlQuery = async (store, parsed, opts) => {
    switch (parsed.queryType) {
        case 'SELECT':
            return await select.handleSparqlSelect(store, parsed, opts);
        default:
            throw new Error(`Unsupported SPARQL query type "${parsed.queryType}"`);
    }
};
module.exports.handleSparqlQuery = handleSparqlQuery;
