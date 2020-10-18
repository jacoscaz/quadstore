import {Algebra} from 'sparqlalgebrajs';
import {Binding, BooleanResult, VoidResult, ResultType} from '../types';
import {Quadstore} from '../quadstore';
import {Quad} from 'rdf-js';
import {Pattern} from 'sparqlalgebrajs/lib/algebra';
import {emptyArray, emptyObject, flatMap} from '../utils';

const patternToQuad = (pattern: Pattern): Quad => {
  // TODO: we should probably add further checks here.
  return <Quad>pattern;
};

/**
 * Handles a `DeleteInsert` operation that does not have a `where` property,
 * meaning that the `delete` and `insert` arrays of `Pattern` are valid quads
 * with no `Variable` terms anywhere.
 *
 * @param store
 * @param operation
 */
export const handleSimpleDeleteInsert = async (store: Quadstore, operation: Algebra.DeleteInsert): Promise<VoidResult|BooleanResult> => {
  return await store.multiPatch(
    operation.delete ? operation.delete.map(patternToQuad) : emptyArray,
    operation.insert ? operation.insert.map(patternToQuad) : emptyArray,
    emptyObject,
  );
};

export const fillPatternWithBinding = (pattern: Pattern, binding: Binding): Quad => {
  const quad = { ...pattern };
  if (pattern.subject && pattern.subject.termType === 'Variable') {
    quad.subject = binding[`?${pattern.subject.value}`];
  }
  if (pattern.predicate && pattern.predicate.termType === 'Variable') {
    quad.predicate = binding[`?${pattern.predicate.value}`];
  }
  if (pattern.object && pattern.object.termType === 'Variable') {
    quad.object = binding[`?${pattern.object.value}`];
  }
  if (pattern.graph && pattern.graph.termType === 'Variable') {
    quad.graph = binding[`?${pattern.graph.value}`];
  }
  return <Quad>quad;
};


export const handleQuery = async (store: Quadstore, operation: Algebra.DeleteInsert): Promise<VoidResult|BooleanResult> => {
  if (!operation.where) {
    return await handleSimpleDeleteInsert(store, operation);
  }
  const results = await store.sparql(operation.where);
  if (results.type !== ResultType.BINDINGS) {
    throw new Error(`Unsupported result type "${results.type}"`);
  }
  let oldQuads: Quad[] = emptyArray; // TODO: ugly use of unknown
  let newQuads: Quad[] = emptyArray; // TODO: ugly use of unknown
  if (operation.delete) {
    oldQuads = flatMap(results.items, (binding) => {
      // TODO: why isn't the TS compiler figuring out that, if we're inside
      //       this `if`, then `operation.delete` surely is not undefined?
      return (<Pattern[]>operation.delete).map(pattern => fillPatternWithBinding(pattern, binding));
    });
  }
  if (operation.insert) {
    newQuads = flatMap(results.items, (binding) => {
      // TODO: why isn't the TS compiler figuring out that, if we're inside
      //       this `if`, then `operation.delete` surely is not undefined?
      return (<Pattern[]>operation.insert).map(pattern => fillPatternWithBinding(pattern, binding));
    });
  }
  return store.multiPatch(oldQuads, newQuads, emptyObject);
};
