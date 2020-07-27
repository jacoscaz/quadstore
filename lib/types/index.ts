
import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import {AsyncIterator} from 'asynciterator';
import { BlankNode, NamedNode, DefaultGraph, Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Quad, Variable, Term, Stream, BaseQuad } from 'rdf-js';


export interface TSEmptyOpts {}

// ****************************************************************************
// ********************************** COMMON **********************************
// ****************************************************************************

export type TSTermName = 'subject' | 'predicate' | 'object' | 'graph';

export interface TSReadable<T> extends AsyncIterator<T> {
  on(eventName: 'data', fn: (chunk: T) => void): this;
  on(eventName: 'end', fn: () => void): this;
  on(eventName: 'error', fn: (err: Error) => void): this;
  read(): T|null;
}

export const enum TSResultType {
  VOID = 'void',
  QUADS = 'quads',
  BINDINGS = 'bindings',
  APPROXIMATE_SIZE = 'approximate_size',
}

export const enum TSSearchStageType {
  BGP = 'bgp',
  LT = 'lt',
  LTE = 'lte',
  GT = 'gt',
  GTE = 'gte',
}


export const enum TSFilterSearchStageType {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
}

// ****************************************************************************
// ******************************** QUADSTORE *********************************
// ****************************************************************************

export interface TSIndex {
  terms: TSTermName[],
  name: string,
  getKey: (quad: TSQuad) => string
}

export interface TSPattern {
  subject?: string,
  predicate?: string,
  object?: string|TSRange,
  graph?: string,
}

export interface TSSimplePattern {
  subject?: string,
  predicate?: string,
  object?: string,
  graph?: string,
}

export interface TSQuad {
  subject: string,
  predicate: string,
  object: string,
  graph: string,
}

export interface TSRange {
  lt?: string,
  lte?: string,
  gt?: string,
  gte?: string,
}

export interface TSBinding {
  [key: string]: string,
}

export interface TSQuadArrayResult {
  type: TSResultType.QUADS,
  items: TSQuad[],
  sorting: TSTermName[],
}

export interface TSQuadStreamResult {
  type: TSResultType.QUADS,
  sorting: TSTermName[],
  iterator: TSReadable<TSQuad>,
}

export interface TSBindingArrayResult {
  type: TSResultType.BINDINGS,
  items: TSBinding[],
  sorting: TSTermName[],
  variables: TSVariables,
}

export interface TSBindingStreamResult {
  type: TSResultType.BINDINGS,
  sorting: TSTermName[],
  variables: TSVariables,
  iterator: TSReadable<TSBinding>,
}

export interface TSVoidResult {
  type: TSResultType.VOID,
}

export interface TSApproximateSizeResult {
  type: TSResultType.APPROXIMATE_SIZE,
  approximateSize: number,
}

export interface TSBgpSearchStage {
  type: TSSearchStageType.BGP,
  optional: boolean,
  pattern: TSSimplePattern,
}

export interface TSFilterSearchStage {
  type: TSSearchStageType.GT|TSSearchStageType.GTE|TSSearchStageType.LT|TSSearchStageType.LTE,
  args: string[],
}

export type TSSearchStage = TSBgpSearchStage|TSFilterSearchStage;

export interface TSStoreOpts {
  backend: AbstractLevelDOWN,
  defaultGraph: string,
  boundary?: string,
  separator?: string,
  indexes?: TSTermName[][],
}

export interface TSGetOpts {
  limit?: number,
  offset?: number,
}

export interface TSGetStrategy {
  index: TSIndex,
  query: TSPattern,
  lt: string[],
  gte: boolean,
  gt: string[],
  lte: boolean,
  valid: boolean,
}

export interface TSPutStreamOpts {
  batchSize?: number,
}

export interface TSDelStreamOpts {
  batchSize?: number,
}

export interface TSStore extends EventEmitter {
  get(pattern: TSPattern, opts: TSGetOpts): Promise<TSQuadArrayResult>
  put(quad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult>
  multiPut(quads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult>
  del(quad: TSQuad, opts: TSEmptyOpts): Promise<TSVoidResult>
  multiDel(Quads: TSQuad[], opts: TSEmptyOpts): Promise<TSVoidResult>
  patch(oldQuad: TSQuad, newQuad: TSQuad, opts: TSEmptyOpts): Promise<TSVoidResult>
  multiPatch(oldQuads: TSQuad[], newQuads: TSQuad[], opts: TSEmptyOpts): Promise<TSVoidResult>
  search(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadArrayResult|TSBindingArrayResult>
  getApproximateSize(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult>
  getStream(pattern: TSPattern, opts: TSGetOpts): Promise<TSQuadStreamResult>
  putStream(source: TSReadable<TSQuad>, opts?: TSPutStreamOpts): Promise<TSVoidResult>
  delStream(source: TSReadable<TSQuad>, opts?: TSDelStreamOpts): Promise<TSVoidResult>
  searchStream(stages: TSSearchStage[], opts?: TSEmptyOpts): Promise<TSQuadStreamResult|TSBindingStreamResult>
}















export type TSVariables = {
  [key: string]: true,
};

export type TSTermsToVarsMap = {
  [key in TSTermName]?: string;
};

export type TSVarsToTermsMap = {
  [key: string]: TSTermName,
};

export type TFilter = {
  type: string,
  args: any[],
};

export interface TSParsedBgpSearchStage extends TSBgpSearchStage {
  pattern: TSSimplePattern,
  variables: TSVariables,
  varsToTermsMap: TSVarsToTermsMap,
  termsToVarsMap: TSTermsToVarsMap,
}

export interface TSParsedFilterSearchStage extends TSFilterSearchStage {
  variables: TSVariables,
}

export type TSParsedSearchStage = TSParsedBgpSearchStage | TSParsedFilterSearchStage;


// ****************************************************************************
// ********************************* RDFSTORE *********************************
// ****************************************************************************

export type TSRdfQuad = Quad;

export interface TSRdfRange {
  lt?: Literal,
  lte?: Literal,
  gt?: Literal,
  gte?: Literal,
}

export interface TSRdfPattern {
  subject?: Quad_Subject,
  predicate?: Quad_Predicate,
  object?: Quad_Object|TSRdfRange,
  graph?: Quad_Graph,
}

export interface TSRdfSimplePattern {
  subject?: Quad_Subject,
  predicate?: Quad_Predicate,
  object?: Quad_Object,
  graph?: Quad_Graph,
}

export interface TSRdfBinding {
  [key: string]: Term,
}

export interface TSRdfQuadArrayResult {
  type: TSResultType.QUADS,
  items: TSRdfQuad[],
  sorting: TSTermName[],
}

export interface TSRdfQuadStreamResult {
  type: TSResultType.QUADS,
  sorting: TSTermName[],
  iterator: TSReadable<TSRdfQuad>,
}

export interface TSRdfBindingArrayResult {
  type: TSResultType.BINDINGS,
  items: TSRdfBinding[],
  sorting: TSTermName[],
  variables: TSVariables,
}

export interface TSRdfBindingStreamResult {
  type: TSResultType.BINDINGS,
  sorting: TSTermName[],
  variables: TSVariables,
  iterator: TSReadable<TSRdfBinding>,
}

export interface TSRdfVoidResult {
  type: TSResultType.VOID,
}

export interface TSRdfBgpSearchStage {
  type: TSSearchStageType.BGP,
  optional: boolean,
  pattern: TSRdfSimplePattern,
}

export interface TSRdfFilterSearchStage {
  type: TSSearchStageType.GT|TSSearchStageType.GTE|TSSearchStageType.LT|TSSearchStageType.LTE,
  args: (Variable|Literal)[],
}

export type TSRdfSearchStage = TSRdfBgpSearchStage|TSRdfFilterSearchStage;

export interface TSRdfStoreOpts {
  backend: AbstractLevelDOWN,
  boundary?: string,
  separator?: string,
  indexes?: TSTermName[][],
  dataFactory: DataFactory,
}

export interface TSRdfStore extends EventEmitter {
  quadstore: TSStore
  dataFactory: DataFactory
  get(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadArrayResult>
  put(quad: TSRdfQuad, opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  multiPut(quads: TSRdfQuad[], opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  del(quad: TSRdfQuad, opts: TSEmptyOpts): Promise<TSRdfVoidResult>
  multiDel(quads: TSRdfQuad[], opts: TSEmptyOpts): Promise<TSRdfVoidResult>
  patch(oldQuad: TSRdfQuad, newQuad: TSRdfQuad, opts: TSEmptyOpts): Promise<TSRdfVoidResult>
  multiPatch(oldQuads: TSRdfQuad[], newQuads: TSRdfQuad[], opts: TSEmptyOpts): Promise<TSRdfVoidResult>
  search(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult>
  sparql(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult|TSRdfVoidResult>
  getApproximateSize(pattern: TSRdfPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult>
  getStream(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadStreamResult>
  putStream(source: TSReadable<TSRdfQuad>, opts?: TSPutStreamOpts): Promise<TSRdfVoidResult>
  delStream(source: TSReadable<TSRdfQuad>, opts?: TSDelStreamOpts): Promise<TSRdfVoidResult>
  searchStream(stages: TSRdfSearchStage[], opts?: TSEmptyOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult>
  sparqlStream(query: string, opts?: TSEmptyOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult|TSRdfVoidResult>
}
