
const handleSparqlSelect = (store, parsed, opts) => {
  return store.searchStream(parsed.where[0].triples, []);
};

const handleSparqlQuery = (store, parsed, opts) => {
  switch (parsed.queryType) {
    case 'SELECT':
      return handleSparqlSelect(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL query type "${parsed.queryType}"`);
  }
};

module.exports.handleSparqlQuery = handleSparqlQuery;
