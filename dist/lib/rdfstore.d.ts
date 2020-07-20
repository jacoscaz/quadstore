/// <reference types="node" />
import { EventEmitter } from 'events';
import QuadStore from './quadstore';
import { DataFactory, Quad, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Store } from 'rdf-js';
import { TSEmptyOpts, TSGetOpts, TSQuad, TSRdfBindingArrayResult, TSRdfBindingStreamResult, TSRdfPattern, TSRdfQuad, TSRdfQuadArrayResult, TSRdfQuadStreamResult, TSRdfSearchStage, TSRdfStore, TSRdfStoreOpts, TSRdfVoidResult, TSReadable } from './types';
declare class RdfStore extends EventEmitter implements TSRdfStore, Store {
    readonly quadstore: QuadStore;
    readonly dataFactory: DataFactory;
    constructor(opts: TSRdfStoreOpts);
    match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph): TSReadable<Quad>;
    import(source: TSReadable<TSRdfQuad>): EventEmitter;
    remove(source: TSReadable<TSRdfQuad>): EventEmitter;
    removeMatches(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph): EventEmitter;
    deleteGraph(graph: Quad_Graph): EventEmitter;
    getApproximateSize(pattern: TSRdfPattern, opts: TSEmptyOpts): Promise<any>;
    sparql(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult | TSRdfBindingArrayResult | TSRdfVoidResult>;
    put(quads: TSRdfQuad | TSRdfQuad[], opts?: TSEmptyOpts | undefined): Promise<void>;
    del(patternOrOldQuads: TSRdfQuad | TSRdfPattern | TSRdfQuad[], opts: TSEmptyOpts): Promise<void>;
    get(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadArrayResult>;
    patch(matchTermsOrOldQuads: TSRdfQuad | TSRdfPattern | TSRdfQuad[], newQuads: TSRdfQuad | TSRdfQuad[], opts: TSEmptyOpts): Promise<void>;
    search(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult | TSRdfBindingArrayResult>;
    getStream(pattern: TSRdfPattern, opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult>;
    putStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void>;
    delStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void>;
    searchStream(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult | TSRdfBindingStreamResult>;
    sparqlStream(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult | TSRdfBindingStreamResult | TSRdfVoidResult>;
    _createQuadSerializerMapper(): (quad: TSRdfQuad) => TSQuad;
    _createQuadDeserializerMapper(): (quad: TSQuad) => TSRdfQuad;
}
export default RdfStore;
