import {ArrayIterator} from 'asynciterator';
import {TSEmptyOpts, TSRdfBinding, TSRdfQuad, TSRdfStore, TSRdfVoidResult, TSResultType, TSTermName} from '../types/index.js';
import {BgpPattern, GraphQuads, InsertDeleteOperation, PropertyPath, Quads, Update, Triple} from 'sparqljs';
import {DefaultGraph, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Variable, NamedNode, BlankNode, Literal} from 'rdf-js';
import {termNames, waitForEvent} from '../utils/index.js';
import * as select from './select.js';

const parseSubject = (subject: NamedNode | BlankNode | Variable | Literal): Quad_Subject => {
  if (subject.termType === 'Literal') {
    throw new Error('Literals not supported');
  }
  return subject;
}

const parsePredicate = (predicate: Literal | BlankNode | NamedNode | Variable | PropertyPath): Quad_Predicate => {
  if ('type' in predicate) {
    throw new Error('Property paths are not supported');
  }
  if (predicate.termType === 'Literal') {
    throw new Error('Literals not supported');
  }
  if (predicate.termType === 'BlankNode') {
    throw new Error('Blank nodes not supported');
  }
  return predicate;
};

const graphTripleToQuad = (store: TSRdfStore, triple: Triple, graph: Quad_Graph): TSRdfQuad => {
  return store.dataFactory.quad(
    parseSubject(triple.subject),
    parsePredicate(triple.predicate),
    triple.object,
    graph,
  );
};

const bgpTripleToQuad = (store: TSRdfStore, triple: Triple): TSRdfQuad => {
  return store.dataFactory.quad(
    parseSubject(triple.subject),
    parsePredicate(triple.predicate),
    triple.object,
    store.dataFactory.defaultGraph(),
  );
};

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
  const iterator = new ArrayIterator(quads).transform({
    transform(quad, done: () => void) {
      store.put([quad])
        .then(done.bind(null, null))
        .catch(done);
    },
  });
  await waitForEvent(iterator, 'end', true);
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
  const iterator = new ArrayIterator(quads).transform({
    transform(quad, done: () => void) {
      store.del([quad], {})
        .then(done.bind(null, null))
        .catch(done);
    },
  });
  await waitForEvent(iterator, 'end', true);
  return { type: TSResultType.VOID };
};

const replaceBindingInPattern = (quad: TSRdfQuad, binding: TSRdfBinding): TSRdfQuad => {
  const p: TSRdfQuad = { ...quad };
  termNames.forEach((termName: TSTermName)  => {
    const term = p[termName];
    if (term.termType !== 'Variable') {
      return;
    }
    const bindingValue = binding[`?${term.value}`];
    if (!bindingValue) {
      return;
    }
    switch (termName) {
      case 'subject':
        if (bindingValue.termType === 'Literal') {
          throw new Error('Invalid');
        }
        if (bindingValue.termType === 'DefaultGraph') {
          throw new Error('Invalid');
        }
        p[termName] = bindingValue;
        break;
      case 'predicate':
        if (bindingValue.termType === 'DefaultGraph') {
          throw new Error('Invalid');
        }
        if (bindingValue.termType === 'BlankNode') {
          throw new Error('Invalid');
        }
        if (bindingValue.termType === 'Literal') {
          throw new Error('Invalid');
        }
        p[termName] = bindingValue;

        break;
      case 'object':
        if (bindingValue.termType === 'DefaultGraph') {
          throw new Error('Invalid');
        }
        p[termName] = bindingValue;
        break;
      case 'graph':
        if (bindingValue.termType === 'Literal') {
          throw new Error('Invalid');
        }
        p[termName] = bindingValue;
        break;
      default:
        throw new Error(`Unexpected term "${termName}"`);
    }
  });
  return p;
};

const sparqlPatternToQuads = (store: TSRdfStore, pattern: Quads, binding: TSRdfBinding = {}): TSRdfQuad[] => {
  const quads: TSRdfQuad[] = [];
  switch (pattern.type) {
    case 'bgp':
      quads.push(...pattern.triples.map(triple => bgpTripleToQuad(store, triple)));
      break;
    case 'graph':
      quads.push(...pattern.triples.map(triple => graphTripleToQuad(store, triple, pattern.name)));
      break;
    default:
      // @ts-ignore
      throw new Error(`Unsupported SPARQL pattern type "${pattern.type}`);
  }
  return quads.map(quad => replaceBindingInPattern(quad, binding));
};

const handleSparqlInsertDelete = async (store: TSRdfStore, update: InsertDeleteOperation, opts: TSEmptyOpts): Promise<TSRdfVoidResult> => {
  const results = await select.handleSparqlSelect(store, { where: update.where }, opts);
  const iterator = results.iterator.transform({
    transform: (binding: TSRdfBinding, done: () => void) => {
      const deleteQuads: TSRdfQuad[] = [];
      const insertQuads: TSRdfQuad[] = [];
      if (update.delete) {
        update.delete.forEach((pattern: Quads) => {
          deleteQuads.push(...sparqlPatternToQuads(store, pattern, binding));
        });
      }
      if (update.insert) {
        update.insert.forEach((pattern: Quads) => {
          insertQuads.push(...sparqlPatternToQuads(store, pattern, binding));
        });
      }
      store.patch(deleteQuads, insertQuads, {})
        .then(done.bind(null, null))
        .catch(done);
    },
  });
  await waitForEvent(iterator, 'end', true);
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
