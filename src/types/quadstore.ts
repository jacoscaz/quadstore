
import {
  IBaseBinding,
  IBaseBindingArrayResults, IBaseBindingStreamResults,
  IBaseQuad,
  IBaseQuadArrayResults, IBaseQuadStreamResults,
  IBaseRange,
  IBaseStore,
  IBaseStoreOpts,
  IBaseTerms,
  IEmptyOpts, IReadable,
  TTermName
} from './base';

export interface IQSQuad extends IBaseQuad<string, string, string, string> {}
export interface IQSRange extends IBaseRange<string> {}
export interface IQSTerms extends IBaseTerms<string|IQSRange, string|IQSRange, string|IQSRange, string|IQSRange> {}
export interface IQSBinding extends IBaseBinding<string> {}
export interface IQSQuadArrayResult extends IBaseQuadArrayResults<IQSQuad> {}
export interface IQSQuadStreamResult extends IBaseQuadStreamResults<IQSQuad> {}
export interface IQSBindingArrayResult extends IBaseBindingArrayResults<IQSBinding> {}
export interface IQSBindingStreamResult extends IBaseBindingStreamResults<IQSBinding> {}

export interface IQSIndex {
  name: string,
  terms: TTermName[],
  getKey: (quad: IQSQuad) => string,
}

export interface IQSStrategy {
  index: IQSIndex,
  query: IQSTerms,
  lt: string[],
  gte: boolean,
  gt: string[],
  lte: boolean,
  valid: boolean,
}

export interface IQSStoreOpts extends IBaseStoreOpts<string> {}

export interface IQSStore extends IBaseStore<IQSQuad, IQSTerms> {}
