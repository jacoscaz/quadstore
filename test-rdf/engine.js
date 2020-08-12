
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/sparql/IQueryEngine.ts

const types = require('../dist/lib/types');
const sparql = require('../dist/lib/sparql');
const RdfStore = require('../dist').RdfStore;
const memdown = require('memdown');
const dataFactory = require('@rdfjs/data-model');

const parse = async (queryString, options) => {
  sparql.parse(queryString);
};

const query = async (data, queryString, options) => {

  const backend = memdown();

  const store = new RdfStore({
    backend,
    dataFactory,
  });

  const compareResults = (a, b) => {
    console.log(arguments);
    const quadComparator = store._getQuadComparator();
    a.sort(quadComparator);
    b.sort(quadComparator);
    for (let i = 0, n = Math.min(a.length, b.length); i < n; i += 1) {
      if (quadComparator(a[i], b[i]) !== 0) {
        return false;
      }
    }
  }

  await store.multiPut(data);
  const results = await store.sparql(queryString);

  switch (results.type) {
    case types.TSResultType.BINDINGS:
      return {
        type: 'bindings',
        value: results.items,
        checkOrder: false,
        variables: results.variables,
        equals: (that, laxCardinality) => compareResults(results.items, that.value),
      };
      break;
    default:
      throw new Error(`Unsupported`);
  }
};

module.exports = { parse, query };
