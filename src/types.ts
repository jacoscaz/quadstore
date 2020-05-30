import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import ai from 'asynciterator';

export type TEmptyOpts = {}

export interface IQuadstoreOpts {
  backend: AbstractLevelDOWN,
  contextKey: string,
  defaultContextValue: string,
  boundary?: string,
  separator?: string,
  indexes?: TQuadstoreIndex,
}

export type TQuadstoreTermName = 'subject' | 'predicate' | 'object' | 'graph';

export type TQuadstoreTerms = {
  subject?: string,
  predicate?: string,
  object?: string,
  graph?: string,
};

export type TQuadstoreMatchTerms = {
  subject?: string|TQuadstoreTermRange,
  predicate?: string|TQuadstoreTermRange,
  object?: string|TQuadstoreTermRange,
  graph?: string|TQuadstoreTermRange,
};

export type TQuadstoreQuad = {
  subject: string,
  predicate: string,
  object: string,
  graph: string,
}

export type TQuadstoreIndex = TQuadstoreTermName[];

export interface IRdfstoreOpts extends IQuadstoreOpts {

}

export interface IQuadstoreQuadStream extends ai.AsyncIterator<TQuadstoreQuad> {}

export type TQuadstoreTermRange = {
  lt?: string,
  lte?: string,
  gt?: string,
  gte?: string,
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


export type TQuadstoreInternalIndex = {
  terms: TQuadstoreTermName[],
  name: string,
  getKey: (quad: TQuadstoreQuad) => string,
}

export type TQuadstoreStrategy = {
  index: TQuadstoreInternalIndex
  query: TQuadstoreMatchTerms,
  lt: string[],
  gte: boolean,
  gt: string[],
  lte: boolean,
  valid: boolean,
}

export type TGetSearchOpts = {
  limit: number,
  offset: number,
}
