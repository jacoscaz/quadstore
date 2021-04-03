import type {Algebra,} from 'sparqlalgebrajs';
import {
  BindingArrayResult,
  BindingStreamResult,
  BooleanResult,
  DefaultGraphMode,
  QuadArrayResult,
  QuadStreamResult,
  ResultType,
  SparqlOpts,
  VoidResult,
} from '../types';
import {Quadstore,} from '../quadstore';
import {
  IActorQueryOperationOutputBindings,
  IActorQueryOperationOutputBoolean,
  IActorQueryOperationOutputQuads,
  IActorQueryOperationOutputUpdate,
  IQueryEngine,
} from "@comunica/types";
import {emptyObject, streamToArray,} from "../utils";

export const sparql = async (store: Quadstore, engine: IQueryEngine, query: Algebra.Operation|string, opts: SparqlOpts = emptyObject): Promise<BindingArrayResult|QuadArrayResult|VoidResult|BooleanResult> => {
  const results = await sparqlStream(store, engine, query, opts);
  switch (results.type) {
    case ResultType.BINDINGS: {
      const items = await streamToArray(results.iterator);
      return {...results, items };
    }
    case ResultType.QUADS: {
      const items = await streamToArray(results.iterator);
      return {...results, items };
    }
    case ResultType.BOOLEAN:
      return results;
    case ResultType.VOID:
      return results;
    default:
      // @ts-ignore
      throw new Error(`Unexpected result type "${results.type}"`);
  }
};

export const sparqlStream = async (store: Quadstore, engine: IQueryEngine, query: Algebra.Operation|string, opts: SparqlOpts = emptyObject): Promise<BindingStreamResult|QuadStreamResult|VoidResult|BooleanResult> => {
  const results = await engine.query(query, {
    sources: [store],
    source: store,
    baseIRI: opts.baseIRI,
    destination: store,
  });
  switch (results.type) {
    case 'boolean':
      return {
        type: ResultType.BOOLEAN,
        value: await (<IActorQueryOperationOutputBoolean>results).booleanResult,
      };
    case 'bindings':
      return {
        type: ResultType.BINDINGS,
        iterator: (<IActorQueryOperationOutputBindings>results).bindingsStream.map(binding => binding.toObject()),
        variables: (<IActorQueryOperationOutputBindings>results).variables,
      };
    case 'quads':
      return {
        type: ResultType.QUADS,
        iterator: (<IActorQueryOperationOutputQuads>results).quadStream,
      };
    case 'update':
      await (<IActorQueryOperationOutputUpdate>results).updateResult;
      return {
        type: ResultType.VOID,
      };
    default:
      throw new Error(`The Comunica engine returned results of unsupported type "${results.type}"`);
  }
};
