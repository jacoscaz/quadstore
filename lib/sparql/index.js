
const { Parser: SparqlParser } = require('sparqljs');

const sparqlParser = new SparqlParser();

// SPARQL!
//   {
//     queryType: 'SELECT',
//     variables: [ Wildcard { id: '' } ],
//     where: [ { type: 'bgp', triples: [Array] } ],
//     type: 'query',
//     prefixes: {}
//   }

const sparqlSelectStream = (store, parsed, opts) => {
  return store.searchStream(parsed.where[0].triples, []);
};

const sparqlStream = (store, query, opts) => {
  const parsed =  sparqlParser.parse(query);
  switch (parsed.queryType) {
    case 'SELECT':
      return sparqlSelectStream(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL query type "${parsed.queryType}"`);
  }
};

module.exports.sparqlStream = sparqlStream;
