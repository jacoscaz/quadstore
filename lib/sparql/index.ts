
import { Parser as SparqlParser, SparqlQuery } from 'sparqljs';
import { handleSparqlUpdate } from './update.js';
import { handleSparqlQuery } from './query.js';
import {
  TSEmptyOpts,
  TSRdfBindingStreamResult,
  TSRdfQuadStreamResult,
  TSRdfStore,
  TSRdfVoidResult, TSSparqlOpts,
} from '../types/index.js';

const sparqlParser = new SparqlParser();

export const parse = (query: string): SparqlQuery => {
  return sparqlParser.parse(query);
};

export const sparqlStream = async (store: TSRdfStore, query: string, opts?: TSSparqlOpts): Promise<TSRdfBindingStreamResult|TSRdfQuadStreamResult|TSRdfVoidResult> => {
  const parsed: SparqlQuery = parse(query);
  switch (parsed.type) {
    case 'query':
      return await handleSparqlQuery(store, parsed, opts);
    case 'update':
      return await handleSparqlUpdate(store, parsed, opts);
    default:
      // @ts-ignore
      throw new Error(`Unsupported SPARQL type "${parsed.type}"`);
  }
};
