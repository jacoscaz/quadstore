
import * as select from './select.js';
import {TSEmptyOpts, TSRdfBindingStreamResult, TSRdfQuadStreamResult, TSRdfStore} from '../types/index.js';
import {Query} from 'sparqljs';

export const handleSparqlQuery = async (store: TSRdfStore, parsed: Query, opts: TSEmptyOpts): Promise<TSRdfBindingStreamResult> => {
  switch (parsed.queryType) {
    case 'SELECT':
      return await select.handleSparqlSelect(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL query type "${parsed.queryType}"`);
  }
};
