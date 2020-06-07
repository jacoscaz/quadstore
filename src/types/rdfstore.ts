
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

import { BlankNode, NamedNode, DefaultGraph, Literal, DataFactory, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Quad } from 'rdf-js';


export interface IRSQuad extends Quad {}

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

export interface IRSStore extends IBaseStore<IRSQuad, IRSTerms> {
  sparql(query: string, opts: IEmptyOpts): Promise<IRSQuadArrayResult|IRSBindingArrayResult>
  sparqlStream(query: string, opts: IEmptyOpts): Promise<IRSQuadStreamResult|IRSBindingStreamResult>
}
