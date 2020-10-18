
import { Readable } from 'stream';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import {AsyncIterator} from 'asynciterator';
import {Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Quad, Term} from 'rdf-js';

export interface EmptyOpts {}

export enum TermName {
  SUBJECT = 'subject',
  PREDICATE = 'predicate',
  OBJECT = 'object',
  GRAPH = 'graph',
}

export type TSReadable<T> = Readable | AsyncIterator<T>;

export enum ResultType {
  VOID = 'void',
  QUADS = 'quads',
  BOOLEAN = 'boolean',
  BINDINGS = 'bindings',
  APPROXIMATE_SIZE = 'approximate_size',
}

export interface InternalIndex {
  terms: TermName[],
  name: string,
  getKey: (quad: ImportedQuad) => string,
  canBeUsedWithPattern: (pattern: ImportedPatternTypes) => boolean,
}

export interface ImportedPattern {
  [TermName.SUBJECT]?: string|ImportedRange,
  [TermName.PREDICATE]?: string|ImportedRange,
  [TermName.OBJECT]?: string|ImportedRange,
  [TermName.GRAPH]?: string|ImportedRange,
}

export interface ImportedPatternTypes {
  [TermName.SUBJECT]?: 'undefined'|'object'|'string'|'number'|'function'|'bigint'|'boolean'|'symbol',
  [TermName.PREDICATE]?: 'undefined'|'object'|'string'|'number'|'function'|'bigint'|'boolean'|'symbol',
  [TermName.OBJECT]?: 'undefined'|'object'|'string'|'number'|'function'|'bigint'|'boolean'|'symbol',
  [TermName.GRAPH]?: 'undefined'|'object'|'string'|'number'|'function'|'bigint'|'boolean'|'symbol',
}

export interface ImportedSimplePattern {
  [TermName.SUBJECT]?: string,
  [TermName.PREDICATE]?: string,
  [TermName.OBJECT]?: string,
  [TermName.GRAPH]?: string,
}

export interface ImportedQuad {
  [TermName.SUBJECT]: string,
  [TermName.PREDICATE]: string,
  [TermName.OBJECT]: string,
  [TermName.GRAPH]: string,
}

export interface ImportedRange {
  lt?: string,
  lte?: string,
  gt?: string,
  gte?: string,
}


export interface ApproximateSizeResult {
  type: ResultType.APPROXIMATE_SIZE,
  approximateSize: number,
}



export interface GetOpts {
  limit?: number,
  offset?: number,
  defaultGraphMode?: DefaultGraphMode,
}

export interface PutStreamOpts {
  batchSize?: number,
}

export interface DelStreamOpts {
  batchSize?: number,
}

export enum DefaultGraphMode {

  /**
   * In "DEFAULT" mode, the default graph is considered to be the actual
   * default graph as referenced by the `store.defaultGraph` property and
   * the RDF/JS `dataFactory.defaultGraph()` method.
   */
  DEFAULT = 'default',

  /**
   * In "UNION" mode, the default graph is considered to be the union of all
   * named graphs.
   */
  UNION = 'union',

}

export { Quad };

export interface Range {
  termType: 'Range',
  lt?: Literal,
  lte?: Literal,
  gt?: Literal,
  gte?: Literal,
}

export interface Pattern {
  [TermName.SUBJECT]?: Quad_Subject,
  [TermName.PREDICATE]?: Quad_Predicate,
  [TermName.OBJECT]?: Quad_Object|Range,
  [TermName.GRAPH]?: Quad_Graph,
}

export interface SimplePattern {
  [TermName.SUBJECT]?: Quad_Subject,
  [TermName.PREDICATE]?: Quad_Predicate,
  [TermName.OBJECT]?: Quad_Object,
  [TermName.GRAPH]?: Quad_Graph,
}

export interface Binding {
  [key: string]: Term,
}

export interface QuadArrayResult {
  type: ResultType.QUADS,
  items: Quad[],
}

export interface QuadStreamResult {
  type: ResultType.QUADS,
  iterator: AsyncIterator<Quad>,
}

export interface BindingArrayResult {
  type: ResultType.BINDINGS,
  items: Binding[],
  variables: string[],
}

export interface BindingStreamResult {
  type: ResultType.BINDINGS,
  iterator: AsyncIterator<Binding>,
  variables: string[],
}

export interface VoidResult {
  type: ResultType.VOID,
}

export interface BooleanResult {
  type: ResultType.BOOLEAN;
  value: boolean;
}

export interface Prefixes {
  expandTerm(term: string): string;
  compactIri(iri: string): string;
}

export interface StoreOpts {
  backend: AbstractLevelDOWN,
  prefixes?: Prefixes,
  boundary?: string,
  separator?: string,
  indexes?: TermName[][],
  dataFactory: DataFactory,
  defaultGraphMode?: DefaultGraphMode,
}

export interface SparqlOpts {
  defaultGraphMode?: DefaultGraphMode,
}
