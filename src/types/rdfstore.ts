
import {
  TSEmptyOpts, TSReadable, TSResultType, TSSearchStageType,
  TSTermName,
} from './common';


import ai from 'asynciterator';
import {AbstractLevelDOWN} from 'abstract-leveldown';
import {EventEmitter} from "events";

import { BlankNode, NamedNode, DefaultGraph, Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Quad, Variable, Term } from 'rdf-js';
import {TSApproximateSizeResult, TSGetOpts, TSVariables} from './quadstore';
import QuadStore from '../quadstore';


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
  iterator: ai.AsyncIterator<TSRdfQuad>,
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
  iterator: ai.AsyncIterator<TSRdfBinding>,
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
  quadstore: QuadStore
  dataFactory: DataFactory
  put(quads: TSRdfQuad|TSRdfQuad[], opts?: TSEmptyOpts): Promise<void>
  del(patternOrQuads: TSRdfPattern|TSRdfQuad|TSRdfQuad[], opts: TSEmptyOpts): Promise<void>
  get(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadArrayResult>
  patch(patternOrOldQuads: TSRdfPattern|TSRdfQuad|TSRdfQuad[], newQuads: TSRdfQuad|TSRdfQuad[], opts: TSEmptyOpts): Promise<void>
  search(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult>
  sparql(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult>
  getApproximateSize(pattern: TSRdfPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult>
  getStream(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadStreamResult>
  putStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void>
  delStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void>
  searchStream(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult>
  sparqlStream(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult>
}
