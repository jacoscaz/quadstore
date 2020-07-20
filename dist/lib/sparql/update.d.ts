import { TSEmptyOpts, TSRdfStore, TSRdfVoidResult } from '../types';
import { Update } from 'sparqljs';
export declare const handleSparqlUpdate: (store: TSRdfStore, parsed: Update, opts: TSEmptyOpts) => Promise<TSRdfVoidResult>;
