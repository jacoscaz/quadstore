
import asynciterator from 'asynciterator';

export type Binding = {
  [key: string]: string,
};

export type GetStreamResults = {
  iterator: asynciterator.AsyncIterator<Binding>,
  variables: Variables,
  sorting: string[],
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
