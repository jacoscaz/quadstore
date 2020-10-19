import {Algebra, translate} from 'sparqlalgebrajs';
import {
  BindingArrayResult,
  BindingStreamResult, BooleanResult, QuadArrayResult,
  QuadStreamResult,
  VoidResult,
  SparqlOpts,
} from '../types';

import * as comunica from './comunica';
import * as deleteInsert from './deleteInsert';

import {Quadstore} from '../quadstore';

export const parse = (store: Quadstore, query: string): Algebra.Operation => {
  return translate(query, {
    quads: true,
    dataFactory: store.dataFactory,
  });
};

export const sparql = async (store: Quadstore, query: Algebra.Operation|string, opts?: SparqlOpts): Promise<BindingArrayResult|QuadArrayResult|VoidResult|BooleanResult> => {
  const operation = typeof query === 'string'
    ? parse(store, query)
    : query;
  const fork = store.fork({ sparqlMode: true, ...opts });
  switch (operation.type) {
    case Algebra.types.PROJECT:
    case Algebra.types.BGP:
    case Algebra.types.SLICE:
    case Algebra.types.CONSTRUCT:
      return await comunica.handleQuery(fork, operation);
    case Algebra.types.DELETE_INSERT:
      // TODO: why do we need to cast the operation into its sub-type?
      //       shouldn't the ts compiler be able to figure out which type
      //       we're dealing with, given that we are switch-ing on the property
      //       that differentiates the various sub-types of the "Operation"
      //       union type?
      return await deleteInsert.handleQuery(fork, <Algebra.DeleteInsert>operation);
    default:
      throw new Error(`Unsupported SPARQL operation "${operation.type}"`);
  }
};

export const sparqlStream = async (store: Quadstore, query: Algebra.Operation|string, opts?: SparqlOpts): Promise<BindingStreamResult|QuadStreamResult|VoidResult|BooleanResult> => {
  const operation = typeof query === 'string'
    ? parse(store, query)
    : query;
  const fork = store.fork({ sparqlMode: true, ...opts });
  switch (operation.type) {
    case Algebra.types.PROJECT:
    case Algebra.types.BGP:
    case Algebra.types.SLICE:
    case Algebra.types.CONSTRUCT:
    case Algebra.types.ORDER_BY:
      return await comunica.handleQueryStream(fork, operation);
    case Algebra.types.DELETE_INSERT:
      throw new Error(`SPARQL DELETE/INSERT queries must use the "sparql()" method`);
    default:
      throw new Error(`Unsupported SPARQL operation "${operation.type}"`);
  }
};
