
import {
  TSResultType, TSSearchStageType,
  TSEmptyOpts, TSReadable,
  TSTermName
} from './common';
import ai from 'asynciterator';
import {AbstractLevelDOWN} from 'abstract-leveldown';
import {EventEmitter} from "events";

export interface TSIndex {
  terms: TSTermName[],
  name: string,
  getKey: (quad: TSQuad) => string
}

export interface TSPattern {
  subject?: string,
  predicate?: string,
  object?: string|TSRange,
  graph?: string,
}

export interface TSSimplePattern {
  subject?: string,
  predicate?: string,
  object?: string,
  graph?: string,
}

export interface TSQuad {
  subject: string,
  predicate: string,
  object: string,
  graph: string,
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
  iterator: ai.AsyncIterator<TSQuad>,
}

export interface TSBindingArrayResult {
  type: TSResultType.BINDINGS,
  items: TSBinding[],
  sorting: TSTermName[],
  variables: TSVariables,
}

export interface TSBindingStreamResult {
  type: TSResultType.BINDINGS,
  sorting: TSTermName[],
  variables: TSVariables,
  iterator: ai.AsyncIterator<TSBinding>,
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

export type TSSearchStage = TSBgpSearchStage|TSFilterSearchStage;

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

export interface TSStore extends EventEmitter {
  put(quads: TSQuad|TSQuad[], opts?: TSEmptyOpts): Promise<void>
  del(patternOrQuads: TSPattern|TSQuad|TSQuad[], opts: TSEmptyOpts): Promise<void>
  get(pattern: TSPattern, opts: TSGetOpts): Promise<TSQuadArrayResult>
  patch(patternOrOldQuads: TSPattern|TSQuad|TSQuad[], newQuads: TSQuad|TSQuad[], opts: TSEmptyOpts): Promise<void>
  search(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadArrayResult|TSBindingArrayResult>
  getApproximateSize(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSApproximateSizeResult>
  getStream(pattern: TSPattern, opts: TSGetOpts): Promise<TSQuadStreamResult>
  putStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<void>
  delStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<void>
  searchStream(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadStreamResult|TSBindingStreamResult>
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

export type TSParsedSearchStage = TSParsedBgpSearchStage | TSParsedFilterSearchStage;

