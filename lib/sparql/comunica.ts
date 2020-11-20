
import {
  BindingArrayResult,
  BindingStreamResult, BooleanResult, QuadArrayResult, QuadStreamResult,
  VoidResult,
  ResultType
} from '../types';
import {Algebra} from 'sparqlalgebrajs';
import {Quadstore} from '../quadstore';

export const handleQuery = async (store: Quadstore, query: Algebra.Operation): Promise<QuadArrayResult|BindingArrayResult|VoidResult|BooleanResult> => {
  const results = await store.engine.query(query, { source: store });
  switch (results.type) {
    case 'boolean':
      return {
        type: ResultType.BOOLEAN,
        value: (await results.booleanResult),
      };
    case 'bindings':
      return {
        type: ResultType.BINDINGS,
        items: (await results.bindings()).map(binding => binding.toObject()),
        variables: results.variables,
      };
    case 'quads':
      return {
        type: ResultType.QUADS,
        items: await results.quads(),
      };
    default:
      // @ts-ignore
      throw new Error(`The Comunica engine returned results of unsupported type "${results.type}"`);
  }
}
export const handleQueryStream = async (store: Quadstore, query: Algebra.Operation): Promise<QuadStreamResult|BindingStreamResult|VoidResult|BooleanResult> => {
  const results = await store.engine.query(query, { source: store });
  switch (results.type) {
    case 'boolean':
      return {
        type: ResultType.BOOLEAN,
        value: (await results.booleanResult),
      };
    case 'bindings':
      return {
        type: ResultType.BINDINGS,
        iterator: results.bindingsStream.map(binding => binding.toObject()),
        variables: results.variables,
      };
    case 'quads':
      return {
        type: ResultType.QUADS,
        iterator: results.quadStream,
      };
    default:
      // @ts-ignore
      throw new Error(`The Comunica engine returned results of unsupported type "${results.type}"`);
  }
};
