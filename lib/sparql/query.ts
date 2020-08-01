
import {handleSparqlSelect} from './select.js';
import {
  TSEmptyOpts,
  TSRdfBindingStreamResult,
  TSRdfQuadStreamResult,
  TSRdfStore,
  TSSparqlOpts
} from '../types/index.js';
import {Query} from 'sparqljs';
import {handleSparqlConstruct} from './construct';

export const handleSparqlQuery = async (store: TSRdfStore, parsed: Query, opts?: TSSparqlOpts): Promise<TSRdfBindingStreamResult|TSRdfQuadStreamResult> => {
  switch (parsed.queryType) {
    case 'SELECT':
      return await handleSparqlSelect(store, parsed, opts);
    case 'CONSTRUCT':
      return await handleSparqlConstruct(store, parsed, opts);
    default:
      throw new Error(`Unsupported SPARQL query type "${parsed.queryType}"`);
  }
};
