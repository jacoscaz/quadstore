





const handleSparqlSelect = (store, parsed, opts) => {
  const patterns = [];
  parsed.where.forEach((whereGroup) => {
    switch (whereGroup.type) {
      case 'graph':
        whereGroup.patterns.forEach((whereGroupPattern) => {
          switch (whereGroupPattern.type) {
            case 'bgp':
              whereGroupPattern.triples.forEach(triple => { patterns.push({ ...triple, graph: whereGroup.name }) });
              break;
            default:
              throw new Error(`Unsupported WHERE group pattern type "${whereGroupPattern.type}"`);
          }
        });
        break;
      case 'bgp':
        whereGroup.triples.forEach(triple => { patterns.push(triple); });
        break;
      default:
        throw new Error(`Unsupported WHERE group type "${whereGroup.type}"`);
    }
  });
  return store.searchStream(patterns, []);
};

module.exports.handleSparqlSelect = handleSparqlSelect;

const handleSparqlQuery = (store, parsed, opts) => {
  switch (parsed.queryType) {
    case 'SELECT':
      return handleSparqlSelect(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL query type "${parsed.queryType}"`);
  }
};

module.exports.handleSparqlQuery = handleSparqlQuery;
