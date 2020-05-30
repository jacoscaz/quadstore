import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import ai from 'asynciterator';
import {DataFactory} from 'rdf-js';

export type TEmptyOpts = {}

export interface TSQuadstoreOpts {
  backend: AbstractLevelDOWN,
  contextKey: string,
  defaultContextValue: string,
  boundary?: string,
  separator?: string,
  indexes?: TQuadstoreIndex,
}

export interface TSRdfstoreOpts extends TSQuadstoreOpts {
  dataFactory: DataFactory
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

export interface IRdfstoreOpts extends TSQuadstoreOpts {

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


/**
 * As we're using asynciterator.AsyncIterator AND stream.Readable instances,
 * we need a generic type that covers both of those.
 */
export interface IReadable<T> extends EventEmitter {
  on(eventName: 'data', fn: (chunk: T) => void): this;
  on(eventName: 'end', fn: () => void): this;
  on(eventName: 'error', fn: (err: Error) => void): this;
  read(): T|null;
}
















export type TBinding = {
  [key: string]: string,
};

export type TGetStreamResults = {
  iterator: ai.AsyncIterator<TBinding>,
  variables: TVariables,
  sorting: TQuadstoreTermName[],
  type: string,
};

export type TVariables = {
  [key: string]: true,
};

export type TMatchTerms = {
  [key: string]: any,
};

export type TTermsToVarsMap = {
  [key in TQuadstoreTermName]?: string;
};

export type TVarsToTermsMap = {
  [key: string]: string,
};

export type TPattern = {
  [key in TQuadstoreTermName]?: string
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
