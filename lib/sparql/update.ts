import {ArrayIterator} from 'asynciterator';
import {
  TSEmptyOpts,
  TSRdfBinding,
  TSRdfQuad,
  TSRdfQuadStreamResult,
  TSRdfStore,
  TSRdfVoidResult,
  TSResultType,
  TSTermName
} from '../types/index.js';
import {BgpPattern, GraphQuads, InsertDeleteOperation, PropertyPath, Quads, Update, Triple} from 'sparqljs';
import {DefaultGraph, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Variable, NamedNode, BlankNode, Literal} from 'rdf-js';
import {consumeOneByOne, termNames, waitForEvent} from '../utils/index.js';
import {handleSparqlSelect, TSHandleSparqlSelectOpts}  from './select.js';
import {bgpTripleToQuad, graphTripleToQuad, sparqlPatternToPatterns} from './utils.js';

const handleSparqlInsert = async (store: TSRdfStore, update: InsertDeleteOperation, opts: TSEmptyOpts): Promise<TSRdfVoidResult> => {
  const quads: TSRdfQuad[] = [];
  if ('insert' in update && Array.isArray(update.insert)) {
    update.insert.forEach((sparqlQuadPattern: Quads) => {
      switch (sparqlQuadPattern.type) {
        case 'bgp':
          quads.push(...sparqlQuadPattern.triples.map(triple => bgpTripleToQuad(store, triple)));
          break;
        case 'graph':
          quads.push(...sparqlQuadPattern.triples.map(triple => graphTripleToQuad(store, triple, sparqlQuadPattern.name)));
          break;
        default:
          // @ts-ignore
          throw new Error(`Unsupported SPARQL insert group type "${sparqlQuadPattern.type}"`);
      }
    });
  }
  await store.multiPut(quads, {});
  return { type: TSResultType.VOID };
};

const handleSparqlDelete = async (store: TSRdfStore, update: InsertDeleteOperation, opts: TSEmptyOpts): Promise<TSRdfVoidResult> => {
  const quads: TSRdfQuad[] = [];
  if ('delete' in update && Array.isArray(update.delete)) {
    update.delete.forEach((sparqlQuadPattern: Quads) => {
      switch (sparqlQuadPattern.type) {
        case 'bgp':
          quads.push(...sparqlQuadPattern.triples.map(triple => bgpTripleToQuad(store, triple)));
          break;
        case 'graph':
          quads.push(...sparqlQuadPattern.triples.map(triple => graphTripleToQuad(store, triple, sparqlQuadPattern.name)));
          break;
        default:
          // @ts-ignore
          throw new Error(`Unsupported SPARQL insert group type "${sparqlQuadPattern.type}"`);
      }
    });
  }
  await store.multiDel(quads, {});
  return { type: TSResultType.VOID };
};

const handleSparqlInsertDelete = async (store: TSRdfStore, update: InsertDeleteOperation, opts: TSEmptyOpts): Promise<TSRdfVoidResult> => {
  const deletePatterns = update.delete
    ? update.delete.flatMap(pattern => sparqlPatternToPatterns(store, pattern))
    : [];
  const insertPatterns = update.insert
    ? update.insert.flatMap(pattern => sparqlPatternToPatterns(store, pattern))
    : [];
  const selectOpts: TSHandleSparqlSelectOpts = {};
  selectOpts.construct = { patterns: [...deletePatterns, ...insertPatterns] };
  const results = <TSRdfQuadStreamResult>await handleSparqlSelect(store, { where: update.where }, selectOpts);
  let i = 0;
  const dl = deletePatterns.length;
  const tl = dl + insertPatterns.length;
  const toDelete = new Array(deletePatterns.length);
  const toInsert = new Array(insertPatterns.length);
  await consumeOneByOne(results.iterator,async (quad) => {
    if (i < dl) {
      toDelete[i] = quad;
      i += 1;
    } else if (i < tl) {
      toInsert[i - dl] = quad;
      i += 1;
    }
    if (i === tl) {
      await store.multiPatch(toDelete, toInsert, {});
      i = 0;
    }
  });
  return { type: TSResultType.VOID };
};

export const handleSparqlUpdate = async (store: TSRdfStore, parsed: Update, opts: TSEmptyOpts): Promise<TSRdfVoidResult> => {
  const { updates } = parsed;
  if (updates.length > 1) {
    throw new Error(`Unsupported number of update groups in query (> 1)`);
  }
  const update = updates[0];
  if (!('updateType' in update)) {
    throw new Error(`Unsupported SPARQL update`);
  }
  switch (update.updateType) {
    case 'insert':
      return await handleSparqlInsert(store, update, opts);
    case 'delete':
      return await handleSparqlDelete(store, update, opts);
    case 'insertdelete':
      return await handleSparqlInsertDelete(store, update, opts);
    default:
      throw new Error(`Unsupported SPARQL update type "${update.updateType}"`);
  }
};

module.exports.handleSparqlUpdate = handleSparqlUpdate;
