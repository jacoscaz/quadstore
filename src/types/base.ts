import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import ai from 'asynciterator';
import {DataFactory, Term} from 'rdf-js';

export interface IEmptyOpts {}

// ****************************************************************************
// *************************** TERMS, QUADS, RANGES ***************************
// ****************************************************************************

export type TTermName = 'subject' | 'predicate' | 'object' | 'graph';

export interface IBaseTerms<S, P, O, G> {
  subject?: S,
  predicate?: P,
  object?: O,
  graph?: G,
}

export interface IBaseQuad<S, P, O, G> {
  subject: S,
  predicate: P,
  object: O,
  graph: G,
}

export interface IBaseRange<T> {
  lt?: T,
  lte?: T,
  gt?: T,
  gte?: T,
}

export interface IBaseBinding<T> {
  [key: string]: T,
}

// ****************************************************************************
// ********************************* RESULTS **********************************
// ****************************************************************************

// As we're using asynciterator.AsyncIterator AND stream.Readable instances,
// we need a generic type that covers both of those.
export interface IReadable<T> extends EventEmitter {
  on(eventName: 'data', fn: (chunk: T) => void): this;
  on(eventName: 'end', fn: () => void): this;
  on(eventName: 'error', fn: (err: Error) => void): this;
  // TODO: this should be T|null but adding null makes it incompatible with
  //       the RDF/JS typings. Perhaps we should make a PR to the typings
  //       repo
  read(): T;
}

export enum EResultType {
  QUADS = 'quads',
  BINDINGS = 'bindings',
}

export interface IBaseQuadArrayResults<T extends IBaseQuad<any, any, any, any>> {
  type: EResultType.QUADS,
  items: T[],
  sorting: TTermName[],
}

export interface IBaseQuadStreamResults<T extends IBaseQuad<any, any, any, any>> {
  type: EResultType.QUADS,
  sorting: TTermName[],
  iterator: ai.AsyncIterator<T>,
}

export interface IBaseBindingArrayResults<T extends IBaseBinding<any>> {
  type: EResultType.BINDINGS,
  items: T[],
  sorting: TTermName[],
}

export interface IBaseBindingStreamResults<T extends IBaseBinding<any>> {
  type: EResultType.BINDINGS,
  sorting: TTermName[],
  iterator: ai.AsyncIterator<T>,
}

// ****************************************************************************
// ********************************** STORE ***********************************
// ****************************************************************************

export interface IBaseStoreOpts<G> {
  backend: AbstractLevelDOWN,
  defaultGraph: G,
  boundary?: string,
  separator?: string,
  indexes?: TTermName[][],
}

export interface IBaseStore<
  Q extends IBaseQuad<any, any, any, any>,
  T extends IBaseTerms<any, any, any, any>
> extends EventEmitter {
  put(quads: Q|Q[], opts?: IEmptyOpts): Promise<void>
  del(matchTermsOrOldQuads: T|Q|Q[], opts: IEmptyOpts): Promise<void>
  get(matchTerms: T, opts: IEmptyOpts): Promise<IBaseQuadArrayResults<Q>>
  patch(matchTermsOrOldQuads: T|Q|Q[], newQuads: Q|Q[], opts: IEmptyOpts): Promise<void>
  getApproximateSize(matchTerms: T, opts: IEmptyOpts): Promise<number>
  getStream(matchTerms: T, opts: IEmptyOpts): Promise<IBaseQuadStreamResults<Q>>
  putStream(source: IReadable<Q>, opts: IEmptyOpts): Promise<void>
  delStream(source: IReadable<Q>, opts: IEmptyOpts): Promise<void>
}

// ****************************************************************************
// ********************************** STUFF ***********************************
// ****************************************************************************

export enum EQuadstoreSearchFilterType {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',

}

export type TQuadstoreSearchFilter = {
  type: EQuadstoreSearchFilterType,
  args: string[],
}

export type TQuadstoreSearchPattern = {
  subject?: string,
  predicate?: string,
  object?: string,
  graph?: string,
}

export type TGetSearchOpts = {
  limit: number,
  offset: number,
}

export type TVariables = {
  [key: string]: true,
};

export type TMatchTerms = {
  [key: string]: any,
};

export type TTermsToVarsMap = {
  [key in TTermName]?: string;
};

export type TVarsToTermsMap = {
  [key: string]: string,
};

export type TPattern = {
  [key in TTermName]?: string
};

export type TParsedPattern = {
  variables: TVariables,
  matchTerms: TMatchTerms,
  termsToVarsMap: TTermsToVarsMap,
  varsToTermsMap: TVarsToTermsMap,
};

export type TFilter = {
  type: string,
  args: any[],
};

export type TParsedFilter = TFilter & {
  variables: { [key: string]: true },
};
