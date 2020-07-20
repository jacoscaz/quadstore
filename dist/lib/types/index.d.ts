/// <reference types="node" />
import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown';
import ai from 'asynciterator';
import { Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Quad, Variable, Term } from 'rdf-js';
export interface TSEmptyOpts {
}
export declare type TSTermName = 'subject' | 'predicate' | 'object' | 'graph';
export interface TSReadable<T> extends EventEmitter {
    on(eventName: 'data', fn: (chunk: T) => void): this;
    on(eventName: 'end', fn: () => void): this;
    on(eventName: 'error', fn: (err: Error) => void): this;
    read(): T;
}
export declare const enum TSResultType {
    VOID = "void",
    QUADS = "quads",
    BINDINGS = "bindings",
    APPROXIMATE_SIZE = "approximate_size"
}
export declare const enum TSSearchStageType {
    BGP = "bgp",
    LT = "lt",
    LTE = "lte",
    GT = "gt",
    GTE = "gte"
}
export declare const enum TSFilterSearchStageType {
    GT = "gt",
    GTE = "gte",
    LT = "lt",
    LTE = "lte"
}
export interface TSIndex {
    terms: TSTermName[];
    name: string;
    getKey: (quad: TSQuad) => string;
}
export interface TSPattern {
    subject?: string;
    predicate?: string;
    object?: string | TSRange;
    graph?: string;
}
export interface TSSimplePattern {
    subject?: string;
    predicate?: string;
    object?: string;
    graph?: string;
}
export interface TSQuad {
    subject: string;
    predicate: string;
    object: string;
    graph: string;
}
export interface TSRange {
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
}
export interface TSBinding {
    [key: string]: string;
}
export interface TSQuadArrayResult {
    type: TSResultType.QUADS;
    items: TSQuad[];
    sorting: TSTermName[];
}
export interface TSQuadStreamResult {
    type: TSResultType.QUADS;
    sorting: TSTermName[];
    iterator: ai.AsyncIterator<TSQuad>;
}
export interface TSBindingArrayResult {
    type: TSResultType.BINDINGS;
    items: TSBinding[];
    sorting: TSTermName[];
    variables: TSVariables;
}
export interface TSBindingStreamResult {
    type: TSResultType.BINDINGS;
    sorting: TSTermName[];
    variables: TSVariables;
    iterator: ai.AsyncIterator<TSBinding>;
}
export interface TSApproximateSizeResult {
    type: TSResultType.APPROXIMATE_SIZE;
    approximateSize: number;
}
export interface TSBgpSearchStage {
    type: TSSearchStageType.BGP;
    optional: boolean;
    pattern: TSSimplePattern;
}
export interface TSFilterSearchStage {
    type: TSSearchStageType.GT | TSSearchStageType.GTE | TSSearchStageType.LT | TSSearchStageType.LTE;
    args: string[];
}
export declare type TSSearchStage = TSBgpSearchStage | TSFilterSearchStage;
export interface TSStoreOpts {
    backend: AbstractLevelDOWN;
    defaultGraph: string;
    boundary?: string;
    separator?: string;
    indexes?: TSTermName[][];
}
export interface TSGetOpts {
    limit?: number;
    offset?: number;
}
export interface TSGetStrategy {
    index: TSIndex;
    query: TSPattern;
    lt: string[];
    gte: boolean;
    gt: string[];
    lte: boolean;
    valid: boolean;
}
export interface TSStore extends EventEmitter {
    put(quads: TSQuad | TSQuad[], opts?: TSEmptyOpts): Promise<void>;
    del(patternOrQuads: TSPattern | TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    get(pattern: TSPattern, opts: TSGetOpts): Promise<TSQuadArrayResult>;
    patch(patternOrOldQuads: TSPattern | TSQuad | TSQuad[], newQuads: TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    search(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadArrayResult | TSBindingArrayResult>;
    getApproximateSize(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult>;
    getStream(pattern: TSPattern, opts: TSGetOpts): Promise<TSQuadStreamResult>;
    putStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<void>;
    delStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<void>;
    searchStream(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadStreamResult | TSBindingStreamResult>;
}
export declare type TSVariables = {
    [key: string]: true;
};
export declare type TSTermsToVarsMap = {
    [key in TSTermName]?: string;
};
export declare type TSVarsToTermsMap = {
    [key: string]: TSTermName;
};
export declare type TFilter = {
    type: string;
    args: any[];
};
export interface TSParsedBgpSearchStage extends TSBgpSearchStage {
    pattern: TSSimplePattern;
    variables: TSVariables;
    varsToTermsMap: TSVarsToTermsMap;
    termsToVarsMap: TSTermsToVarsMap;
}
export interface TSParsedFilterSearchStage extends TSFilterSearchStage {
    variables: TSVariables;
}
export declare type TSParsedSearchStage = TSParsedBgpSearchStage | TSParsedFilterSearchStage;
export declare type TSRdfQuad = Quad;
export interface TSRdfRange {
    lt?: Literal;
    lte?: Literal;
    gt?: Literal;
    gte?: Literal;
}
export interface TSRdfPattern {
    subject?: Quad_Subject;
    predicate?: Quad_Predicate;
    object?: Quad_Object | TSRdfRange;
    graph?: Quad_Graph;
}
export interface TSRdfSimplePattern {
    subject?: Quad_Subject;
    predicate?: Quad_Predicate;
    object?: Quad_Object;
    graph?: Quad_Graph;
}
export interface TSRdfBinding {
    [key: string]: Term;
}
export interface TSRdfQuadArrayResult {
    type: TSResultType.QUADS;
    items: TSRdfQuad[];
    sorting: TSTermName[];
}
export interface TSRdfQuadStreamResult {
    type: TSResultType.QUADS;
    sorting: TSTermName[];
    iterator: ai.AsyncIterator<TSRdfQuad>;
}
export interface TSRdfBindingArrayResult {
    type: TSResultType.BINDINGS;
    items: TSRdfBinding[];
    sorting: TSTermName[];
    variables: TSVariables;
}
export interface TSRdfBindingStreamResult {
    type: TSResultType.BINDINGS;
    sorting: TSTermName[];
    variables: TSVariables;
    iterator: ai.AsyncIterator<TSRdfBinding>;
}
export interface TSRdfVoidResult {
    type: TSResultType.VOID;
}
export interface TSRdfBgpSearchStage {
    type: TSSearchStageType.BGP;
    optional: boolean;
    pattern: TSRdfSimplePattern;
}
export interface TSRdfFilterSearchStage {
    type: TSSearchStageType.GT | TSSearchStageType.GTE | TSSearchStageType.LT | TSSearchStageType.LTE;
    args: (Variable | Literal)[];
}
export declare type TSRdfSearchStage = TSRdfBgpSearchStage | TSRdfFilterSearchStage;
export interface TSRdfStoreOpts {
    backend: AbstractLevelDOWN;
    boundary?: string;
    separator?: string;
    indexes?: TSTermName[][];
    dataFactory: DataFactory;
}
export interface TSRdfStore extends EventEmitter {
    quadstore: TSStore;
    dataFactory: DataFactory;
    put(quads: TSRdfQuad | TSRdfQuad[], opts?: TSEmptyOpts): Promise<void>;
    del(patternOrQuads: TSRdfPattern | TSRdfQuad | TSRdfQuad[], opts: TSEmptyOpts): Promise<void>;
    get(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadArrayResult>;
    patch(patternOrOldQuads: TSRdfPattern | TSRdfQuad | TSRdfQuad[], newQuads: TSRdfQuad | TSRdfQuad[], opts: TSEmptyOpts): Promise<void>;
    search(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult | TSRdfBindingArrayResult>;
    sparql(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult | TSRdfBindingArrayResult | TSRdfVoidResult>;
    getApproximateSize(pattern: TSRdfPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult>;
    getStream(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadStreamResult>;
    putStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void>;
    delStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void>;
    searchStream(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult | TSRdfBindingStreamResult>;
    sparqlStream(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult | TSRdfBindingStreamResult | TSRdfVoidResult>;
}
