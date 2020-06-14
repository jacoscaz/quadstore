import { EventEmitter } from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown'
import ai from 'asynciterator';
import {DataFactory, Term} from 'rdf-js';

export interface TSEmptyOpts {}

// ****************************************************************************
// *************************** TERMS, QUADS, RANGES ***************************
// ****************************************************************************

export type TSTermName = 'subject' | 'predicate' | 'object' | 'graph';

// As we're using asynciterator.AsyncIterator AND stream.Readable instances,
// we need a generic type that covers both of those.
export interface TSReadable<T> extends EventEmitter {
  on(eventName: 'data', fn: (chunk: T) => void): this;
  on(eventName: 'end', fn: () => void): this;
  on(eventName: 'error', fn: (err: Error) => void): this;
  // TODO: this should be T|null but adding null makes it incompatible with
  //       the RDF/JS typings. Perhaps we should make a PR to the typings
  //       repo
  read(): T;
}

export enum TSResultType {
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
}


export enum TSFilterSearchStageType {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
}
