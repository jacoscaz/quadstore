
import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import {AsyncIterator} from 'asynciterator';
import { BlankNode, NamedNode, DefaultGraph, Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Quad, Variable, Term, Stream, BaseQuad } from 'rdf-js';


export interface TSEmptyOpts {}

// ****************************************************************************
// ********************************** COMMON **********************************
// ****************************************************************************

export enum TSTermName {
  SUBJECT = 'subject',
  PREDICATE = 'predicate',
  OBJECT = 'object',
  GRAPH = 'graph',
}

// export type TSTermName = 'subject' | 'predicate' | 'object' | 'graph';

export interface TSReadable<T> extends AsyncIterator<T> {
  on(eventName: 'data', fn: (chunk: T) => void): this;
  on(eventName: 'end', fn: () => void): this;
  on(eventName: 'error', fn: (err: Error) => void): this;
  read(): T|null;
}

export enum TSResultType {
  VOID = 'void',
  QUADS = 'quads',
  BINDINGS = 'bindings',
  APPROXIMATE_SIZE = 'approximate_size',
}

export enum TSSearchStageType {
  BGP = 'bgp',
  LT = 'lt',
  LTE = 'lte',
  GT = 'gt',
  GTE = 'gte',
  CONSTRUCT = 'construct',
  PROJECT = 'project',
}


export enum TSFilterSearchStageType {
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
  [TSTermName.SUBJECT]?: string,
  [TSTermName.PREDICATE]?: string,
  [TSTermName.OBJECT]?: string|TSRange,
  [TSTermName.GRAPH]?: string,
}

export interface TSSimplePattern {
  [TSTermName.SUBJECT]?: string,
  [TSTermName.PREDICATE]?: string,
  [TSTermName.OBJECT]?: string,
  [TSTermName.GRAPH]?: string,
}

export interface TSQuad {
  [TSTermName.SUBJECT]: string,
  [TSTermName.PREDICATE]: string,
  [TSTermName.OBJECT]: string,
  [TSTermName.GRAPH]: string,
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
  sorting: string[],
  variables: TSVariables,
}

export interface TSBindingStreamResult {
  type: TSResultType.BINDINGS,
  sorting: string[],
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

export interface TSConstructSearchStage {
  type: TSSearchStageType.CONSTRUCT,
  patterns: TSSimplePattern[],
}

export interface TSProjectSearchStage {
  type: TSSearchStageType.PROJECT,
  variables: string[],
}

export type TSSearchStage = TSBgpSearchStage|TSFilterSearchStage|TSConstructSearchStage|TSProjectSearchStage;

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
  defaultGraphMode?: TSDefaultGraphMode,
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

export enum TSDefaultGraphMode {
  DEFAULT = 'default',
  MERGE = 'merge'
}

export interface TSSearchOpts {
  defaultGraphMode?: TSDefaultGraphMode
}

export interface TSStore extends EventEmitter {
  get(pattern: TSPattern, opts?: TSGetOpts): Promise<TSQuadArrayResult>
  put(quad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult>
  multiPut(quads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult>
  del(quad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult>
  multiDel(Quads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult>
  patch(oldQuad: TSQuad, newQuad: TSQuad, opts?: TSEmptyOpts): Promise<TSVoidResult>
  multiPatch(oldQuads: TSQuad[], newQuads: TSQuad[], opts?: TSEmptyOpts): Promise<TSVoidResult>
  search(stages: TSSearchStage[], opts?: TSSearchOpts): Promise<TSQuadArrayResult|TSBindingArrayResult>
  getApproximateSize(pattern: TSPattern, opts?: TSGetOpts): Promise<TSApproximateSizeResult>
  getStream(pattern: TSPattern, opts?: TSGetOpts): Promise<TSQuadStreamResult>
  putStream(source: TSReadable<TSQuad>, opts?: TSPutStreamOpts): Promise<TSVoidResult>
  delStream(source: TSReadable<TSQuad>, opts?: TSDelStreamOpts): Promise<TSVoidResult>
  searchStream(stages: TSSearchStage[], opts?: TSSearchOpts): Promise<TSQuadStreamResult|TSBindingStreamResult>
  getTermComparator(): (a: string, b: string) => -1|0|1
  getQuadComparator(termNames?: TSTermName[]): (a: TSQuad, b: TSQuad) => -1|0|1
  getBindingComparator(termNames: string[]): (a: TSBinding, b: TSBinding) => -1|0|1
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

export interface TSParsedConstructSearchStage extends TSConstructSearchStage {}

export interface TSParsedProjectSearchStage extends TSProjectSearchStage {}

export type TSParsedSearchStage = TSParsedBgpSearchStage|TSParsedFilterSearchStage|TSParsedConstructSearchStage|TSParsedProjectSearchStage;


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
  [TSTermName.SUBJECT]?: Quad_Subject,
  [TSTermName.PREDICATE]?: Quad_Predicate,
  [TSTermName.OBJECT]?: Quad_Object|TSRdfRange,
  [TSTermName.GRAPH]?: Quad_Graph,
}

export interface TSRdfSimplePattern {
  [TSTermName.SUBJECT]?: Quad_Subject,
  [TSTermName.PREDICATE]?: Quad_Predicate,
  [TSTermName.OBJECT]?: Quad_Object,
  [TSTermName.GRAPH]?: Quad_Graph,
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
  sorting: string[],
  variables: TSVariables,
}

export interface TSRdfBindingStreamResult {
  type: TSResultType.BINDINGS,
  sorting: string[],
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

export interface TSRdfConstructSearchStage {
  type: TSSearchStageType.CONSTRUCT,
  patterns: TSRdfSimplePattern[],
}

export interface TSRdfFilterSearchStage {
  type: TSSearchStageType.GT|TSSearchStageType.GTE|TSSearchStageType.LT|TSSearchStageType.LTE,
  args: (Variable|Literal)[],
}

export interface TSRdfProjectSearchStage {
  type: TSSearchStageType.PROJECT,
  variables: string[],
}

export type TSRdfSearchStage = TSRdfBgpSearchStage|TSRdfFilterSearchStage|TSRdfConstructSearchStage|TSRdfProjectSearchStage;

export interface TSRdfStoreOpts {
  backend: AbstractLevelDOWN,
  boundary?: string,
  separator?: string,
  indexes?: TSTermName[][],
  dataFactory: DataFactory,
}

export interface TSSparqlOpts {
  defaultGraphMode?: TSDefaultGraphMode,
}

export interface TSRdfStore extends EventEmitter {
  quadstore: TSStore
  dataFactory: DataFactory
  get(pattern: TSRdfPattern, opts?: TSGetOpts): Promise<TSRdfQuadArrayResult>
  put(quad: TSRdfQuad, opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  multiPut(quads: TSRdfQuad[], opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  del(quad: TSRdfQuad, opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  multiDel(quads: TSRdfQuad[], opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  patch(oldQuad: TSRdfQuad, newQuad: TSRdfQuad, opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  multiPatch(oldQuads: TSRdfQuad[], newQuads: TSRdfQuad[], opts?: TSEmptyOpts): Promise<TSRdfVoidResult>
  search(stages: TSRdfSearchStage[], opts?: TSSearchOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult>
  sparql(query: string, opts?: TSSparqlOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult|TSRdfVoidResult>
  getApproximateSize(pattern: TSRdfPattern, opts?: TSGetOpts): Promise<TSApproximateSizeResult>
  getStream(pattern: TSRdfPattern, opts?: TSGetOpts): Promise<TSRdfQuadStreamResult>
  putStream(source: TSReadable<TSRdfQuad>, opts?: TSPutStreamOpts): Promise<TSRdfVoidResult>
  delStream(source: TSReadable<TSRdfQuad>, opts?: TSDelStreamOpts): Promise<TSRdfVoidResult>
  searchStream(stages: TSRdfSearchStage[], opts?: TSSearchOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult>
  sparqlStream(query: string, opts?: TSSparqlOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult|TSRdfVoidResult>
  getTermComparator(): (a: Term, b: Term) => -1|0|1
  getQuadComparator(termNames?: TSTermName[]): (a: Quad, b: Quad) => -1|0|1
  getBindingComparator(termNames: string[]): (a: TSRdfBinding, b: TSRdfBinding) => -1|0|1
}
