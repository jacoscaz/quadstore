
import {
  BindingArrayResult,
  BindingStreamResult, BooleanResult, QuadArrayResult, QuadStreamResult,
  VoidResult,
  ResultType
} from '../types';
import {TransformIterator} from 'asynciterator';
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
        // TODO: there seems to be something wrong with Comunica's typings as
        //       `results.bindings()` returns an array of Immutable.js objects
        //       while the compiler thinks it's an array of `Term`.
        // @ts-ignore
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
        // TODO: there seems to be something wrong with Comunica's typings as
        //       `results.bindings()` returns an array of Immutable.js objects
        //       while the compiler thinks it's an array of `Term`.
        // @ts-ignore
        iterator: results.bindingsStream.map(binding => binding.toObject()),
        variables: results.variables,
      };
    case 'quads':
      return {
        type: ResultType.QUADS,
        iterator: new TransformIterator(results.quadStream),
      };
    default:
      // @ts-ignore
      throw new Error(`The Comunica engine returned results of unsupported type "${results.type}"`);
  }
};
