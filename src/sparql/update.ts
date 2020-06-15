
import ai from 'asynciterator';
import * as select from './select';
import {TSEmptyOpts, TSRdfQuad, TSRdfStore} from '../types';

const handleSparqlInsert = async (store: TSRdfStore, update, opts: TSEmptyOpts) => {
  const quads = update.insert.reduce((acc: TSRdfQuad[], group) => {
    switch (group.type) {
      case 'bgp':
        acc.push(...group.triples.map(triple => ({ ...triple, graph: store.dataFactory.defaultGraph()})));
        break;
      case 'graph':
        acc.push(...group.triples.map(triple => ({ ...triple, graph: group.name})));
        break;
      default:
        throw new Error(`Unsupported SPARQL insert group type "${group.type}"`);
    }
    return acc;
  }, []);
  const iterator = new ai.ArrayIterator(quads).transform((quad, done) => {
    store.put([quad])
      .then(done.bind(null, null))
      .catch(done);
  });
  return { type: enums.resultType.BINDINGS, iterator };
};

const handleSparqlDelete = async (store, update, opts) => {
  const quads = update.delete.reduce((acc, group) => {
    switch (group.type) {
      case 'bgp':
        acc.push(...group.triples);
        break;
      case 'graph':
        acc.push(...group.triples.map(t => ({ ...t, graph: group.name})));
        break;
      default:
        throw new Error(`Unsupported SPARQL delete group type "${group.type}"`);
    }
    return acc;
  }, []);
  const iterator = new ai.ArrayIterator(quads).transform((quad, done) => {
    store.del([quad])
      .then(done.bind(null, null))
      .catch(done);
  });
  return { type: enums.resultType.BINDINGS, iterator };
};

const replaceBindingInPattern = (pattern, binding) => {
  const p = { ...pattern };
  ['subject', 'predicate', 'object', 'graph'].forEach(term => {
    if (p[term] && p[term].termType === 'Variable' && binding[p[term].id]) {
      p[term] = binding[p[term].id];
    }
  });
  return p;
};

const sparqlPatternToQuads = (pattern, binding = {}) => {
  const quads = [];
  switch (pattern.type) {
    case 'bgp':
      quads.push(...pattern.triples.map(
        triple => replaceBindingInPattern(triple, binding)
      ));
      break;
    case 'graph':
      quads.push(...pattern.triples.map(
        triple => replaceBindingInPattern({ ...triple, graph: pattern.name }, binding)
      ));
      break;
    default:
      throw new Error(`Unsupported SPARQL pattern type "${pattern.type}`);
  }
  return quads;
};

const handleSparqlInsertDelete = async (store, update, opts) => {
  const results = (await handleSparqlSelect(store, { where: update.where }, opts));
  const iterator = results.iterator.transform((binding, done) => {
    const deletePatterns = update.delete.reduce((acc, pattern) => {
      return [...acc, ...sparqlPatternToQuads(pattern, binding)]
    }, []);
    const insertPatterns = update.insert.reduce((acc, pattern) => {
      return [...acc, ...sparqlPatternToQuads(pattern, binding)]
    }, []);
    store.patch(deletePatterns, insertPatterns)
      .then(done.bind(null, null))
      .catch(done);
  });
  return { type: enums.resultType.BINDINGS, iterator };
};

const handleSparqlUpdate = async (store: TSRdfStore, parsed, opts) => {
  const { updates } = parsed;
  if (updates.length > 1) {
    throw new Error(`Unsupported number of update groups in query (> 1)`);
  }
  const update = updates[0];
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
