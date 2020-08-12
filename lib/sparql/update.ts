import {
  TSEmptyOpts,
  TSRdfQuad,
  TSRdfQuadStreamResult,
  TSRdfSearchStage,
  TSRdfStore,
  TSRdfVoidResult,
  TSResultType, TSSearchOpts,
  TSSearchStageType,
  TSSparqlOpts
} from '../types/index.js';
import {InsertDeleteOperation, Quads, Update} from 'sparqljs';
import {consumeOneByOne, flatMap} from '../utils/index.js';
import {sparqlWherePatternArrayToStages, TSHandleSparqlSelectOpts} from './select.js';
import {bgpTripleToQuad, graphTripleToQuad, sparqlPatternToPatterns} from './utils.js';

const handleSparqlInsert = async (store: TSRdfStore, update: InsertDeleteOperation, opts?: TSSparqlOpts): Promise<TSRdfVoidResult> => {
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

const handleSparqlDelete = async (store: TSRdfStore, update: InsertDeleteOperation, opts?: TSEmptyOpts): Promise<TSRdfVoidResult> => {
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

const handleSparqlInsertDelete = async (store: TSRdfStore, update: InsertDeleteOperation, opts?: TSSparqlOpts): Promise<TSRdfVoidResult> => {
  const deletePatterns = update.delete
    ? flatMap(update.delete, pattern => sparqlPatternToPatterns(store, pattern))
    : [];
  const insertPatterns = update.insert
    ? flatMap(update.insert, pattern => sparqlPatternToPatterns(store, pattern))
    : [];
  if (!update.where) {
    // TODO: is the "WHERE" block mandatory for UPDATE queries?
    throw new Error('missing WHERE pattern group');
  }
  const stages: TSRdfSearchStage[] = sparqlWherePatternArrayToStages(update.where);
  stages.push({
    type: TSSearchStageType.CONSTRUCT,
    patterns: [...deletePatterns, ...insertPatterns],
  });
  const searchOpts: TSSearchOpts = opts ? { ...opts } : {};
  const results = <TSRdfQuadStreamResult>await store.searchStream(stages, searchOpts);
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

export const handleSparqlUpdate = async (store: TSRdfStore, parsed: Update, opts?: TSSparqlOpts): Promise<TSRdfVoidResult> => {
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
