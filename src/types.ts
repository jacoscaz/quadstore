import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import ai from 'asynciterator';
import {DataFactory} from 'rdf-js';

export type TEmptyOpts = {}

export interface TSQuadstoreOpts<QT> {
  backend: AbstractLevelDOWN,
  contextKey: string,
  defaultContextValue: QT,
  boundary?: string,
  separator?: string,
  indexes?: TSTermName[][],
}

export interface TSRdfstoreOpts<QT> extends TSQuadstoreOpts<QT> {
  dataFactory: DataFactory
}

export type TSTermName = 'subject' | 'predicate' | 'object' | 'graph';

export interface TSBaseQuad extends TSBaseTerms {
  subject: any,
  predicate: any,
  object: any,
  graph: any,
}

export interface TSBaseTerms {
  subject?: any,
  predicate?: any,
  object?: any,
  graph?: any,
}

export interface TSBaseRange {
  lt?: any,
  lte?: any,
  gt?: any,
  gte?: any,
}

export interface TSTerms<T> extends TSBaseTerms {
  subject?: T,
  predicate?: T,
  object?: T,
  graph?: T,
}

export interface TSQuad<T> extends TSTerms<T> {
  subject: T,
  predicate: T,
  object: T,
  graph: T,
}

export interface TSRange<T> extends TSBaseRange {
  lt?: T,
  lte?: T,
  gt?: T,
  gte?: T,
}

export type TSIndex<QT> = {
  terms: TSTermName[],
  name: string,
  getKey: (quad: TSQuad<QT>) => string,
}

export type TQuadstoreStrategy<QT, TT> = {
  index: TSIndex<QT>
  query: TSTerms<TT>,
  lt: string[],
  gte: boolean,
  gt: string[],
  lte: boolean,
  valid: boolean,
}

/**
 * As we're using asynciterator.AsyncIterator AND stream.Readable instances,
 * we need a generic type that covers both of those.
 */
export interface TSReadable<T> extends EventEmitter {
  on(eventName: 'data', fn: (chunk: T) => void): this;
  on(eventName: 'end', fn: () => void): this;
  on(eventName: 'error', fn: (err: Error) => void): this;
  // TODO: this should be T|null but adding null makes it incompatible with
  //       the RDF/JS typings. Perhaps we should make a PR to the typings
  //       repo
  read(): T;
}


























export type TQuadstoreSearchPattern = {
  subject?: string,
  predicate?: string,
  object?: string,
  graph?: string,
}

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




export type TGetSearchOpts = {
  limit: number,
  offset: number,
}



















export type TBinding = {
  [key: string]: string,
};

export type TGetStreamResults = {
  iterator: ai.AsyncIterator<TBinding>,
  variables: TVariables,
  sorting: TSTermName[],
  type: string,
};

export type TVariables = {
  [key: string]: true,
};

export type TMatchTerms = {
  [key: string]: any,
};

export type TTermsToVarsMap = {
  [key in TSTermName]?: string;
};

export type TVarsToTermsMap = {
  [key: string]: string,
};

export type TPattern = {
  [key in TSTermName]?: string
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
