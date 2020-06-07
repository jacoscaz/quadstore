
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

import { BlankNode, NamedNode, DefaultGraph, Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph } from 'rdf-js';


export interface IRSQuad extends IBaseQuad<
  Quad_Subject,
  Quad_Predicate,
  Quad_Object,
  Quad_Graph
> {}

export interface IRSRange extends IBaseRange<Literal> {}

export interface IRSTerms extends IBaseTerms<
  Quad_Subject,
  Quad_Predicate,
  Quad_Object|IRSRange,
  Quad_Graph
> {}

export interface IRSBinding extends IBaseBinding<BlankNode|Literal|NamedNode|DefaultGraph> {}

export interface IRSQuadArrayResult extends IBaseQuadArrayResults<IRSQuad> {}
export interface IRSQuadStreamResult extends IBaseQuadStreamResults<IRSQuad> {}
export interface IRSBindingArrayResult extends IBaseBindingArrayResults<IRSBinding> {}
export interface IRSBindingStreamResult extends IBaseBindingStreamResults<IRSBinding> {}

export interface IRSStoreOpts extends IBaseStoreOpts<NamedNode> {
  dataFactory: DataFactory
}

export interface IRSStore extends IBaseStore<IRSQuad, IRSTerms> {}
