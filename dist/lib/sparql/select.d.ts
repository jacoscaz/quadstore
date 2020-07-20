import { TSEmptyOpts, TSRdfBindingStreamResult, TSRdfStore } from '../types';
import { Pattern } from 'sparqljs';
export declare const handleSparqlSelect: (store: TSRdfStore, parsed: {
    where?: Pattern[];
}, opts: TSEmptyOpts) => Promise<TSRdfBindingStreamResult>;
