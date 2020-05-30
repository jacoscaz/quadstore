
const _ = require('../utils/lodash');
const { Parser: SparqlParser } = require('sparqljs');
const { handleSparqlUpdate } = require('./update');
const { handleSparqlQuery } = require('./query');

const sparqlParser = new SparqlParser();

const parse = (query) => {
  return sparqlParser.parse(query);
};

module.exports.parse = parse;

const sparqlStream = async (store, query, opts) => {
  const parsed = parse(query);
  switch (parsed.type) {
    case 'query':
      return await handleSparqlQuery(store, parsed, opts);
    case 'update':
      return await handleSparqlUpdate(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL type "${parsed.type}"`);
  }
};

module.exports.sparqlStream = sparqlStream;
