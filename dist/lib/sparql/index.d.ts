import { SparqlQuery } from 'sparqljs';
import { TSEmptyOpts, TSRdfBindingStreamResult, TSRdfQuadStreamResult, TSRdfStore, TSRdfVoidResult } from '../types';
export declare const parse: (query: string) => SparqlQuery;
export declare const sparqlStream: (store: TSRdfStore, query: string, opts: TSEmptyOpts) => Promise<TSRdfBindingStreamResult | TSRdfQuadStreamResult | TSRdfVoidResult>;
