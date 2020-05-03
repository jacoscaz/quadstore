

const { Parser: SparqlParser } = require('sparqljs');
const { handleSparqlUpdate } = require('./update');
const { handleSparqlQuery } = require('./query');

const sparqlParser = new SparqlParser();

// PREFIX  dc:  <http://purl.org/dc/elements/1.1/>
//   SELECT  ?title
//     WHERE   { ?x dc:title ?title
//   FILTER regex(?title, "web", "i" )
// }

//   {
//     queryType: 'SELECT',
//     variables: [ Wildcard { id: '' } ],
//     where: [ { type: 'bgp', triples: [Array] } ],
//     type: 'query',
//     prefixes: {}
//   }





const sparqlStream = (store, query, opts) => {
  const parsed = sparqlParser.parse(query);
  switch (parsed.type) {
    case 'query':
      return handleSparqlQuery(store, parsed, opts);
    case 'update':
      return handleSparqlUpdate(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL type "${parsed.type}"`);
  }
};

module.exports.sparqlStream = sparqlStream;
