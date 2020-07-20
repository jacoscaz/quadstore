import { TSEmptyOpts, TSRdfBindingStreamResult, TSRdfStore } from '../types';
import { Query } from 'sparqljs';
export declare const handleSparqlQuery: (store: TSRdfStore, parsed: Query, opts: TSEmptyOpts) => Promise<TSRdfBindingStreamResult>;
