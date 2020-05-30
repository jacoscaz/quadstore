
import asynciterator from 'asynciterator';
import {TQuadstoreTermName} from '../types';

export type Binding = {
  [key: string]: string,
};

export type GetStreamResults = {
  iterator: asynciterator.AsyncIterator<Binding>,
  variables: Variables,
  sorting: TQuadstoreTermName[],
  type: string,
};

export type Variables = {
  [key: string]: true,
};

export type MatchTerms = {
  [key: string]: any,
};

export type TermsToVarsMap = {
  [key: string]: string,
};

export type VarsToTermsMap = {
  [key: string]: string,
};

export type ParsedPattern = {
  variables: Variables,
  matchTerms: MatchTerms,
  termsToVarsMap: TermsToVarsMap,
  varsToTermsMap: VarsToTermsMap,
};

export type Quad = {
  [key: string]: string,
};




// export type TermName<T extends string> = 'subject' | 'predicate' | 'object' | T;
//
// export type Terms<K extends string, V> = {
//   [key in TermName<K>]: V;
// };
//
// export type Quad<K extends string, V> = {
//   subject: V,
//   predicate: V,
//   object: V,
//   [key: K]: V,
// };

// search([
//   {
//     type: 'pattern',
//     terms: {}
//   },
//   {
//     type: 'operation',
//     operator: '',
//     args: [],
//   }
// ])




export type MatchPattern = {
  type: 'pattern',
  pattern: {},
};

export type Expression = {
  type: 'expression',
  operator: '',
  args: [],
};





