
const { EventEmitter } = require('events');
const AsyncIterator = require('asynciterator');
const { handleSparqlSelect } = require('./query');

const handleSparqlInsert = (store, update, opts) => {
  const quads = update.insert.reduce((acc, group) => {
    switch (group.type) {
      case 'bgp':
        acc.push(...group.triples);
        break;
      case 'graph':
        acc.push(...group.triples.map(t => ({ ...t, graph: group.name})));
        break;
      default:
        throw new Error(`Unsupported SPARQL insert group type "${group.type}"`);
    }
    return acc;
  }, []);
  return store.import(new AsyncIterator.ArrayIterator(quads));
};

const handleSparqlDelete = (store, update, opts) => {
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
  return store.remove(new AsyncIterator.ArrayIterator(quads));
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

const handleSparqlInsertDelete = (store, update, opts) => {
  const iterator = handleSparqlSelect(store, { where: update.where }, opts);
  return iterator.transform((binding, done) => {
    const deletePatterns = update.delete.reduce((acc, pattern) => {
      return [...acc, ...sparqlPatternToQuads(pattern, binding)]
    }, []);
    const insertPatterns = update.insert.reduce((acc, pattern) => {
      return [...acc, ...sparqlPatternToQuads(pattern, binding)]
    }, []);
    const emitter = new EventEmitter();
    store.patch(deletePatterns, insertPatterns, (err) => {
      if (err) {
        emitter.emit('error', err);
        return;
      }
      emitter.emit('end');
    });
    done();
  });
};

const handleSparqlUpdate = (store, parsed, opts) => {
  const emitter = new EventEmitter();
  const { updates } = parsed;
  let remaining = updates.length;
  let iterator;
  for (const update of updates) {
    switch (update.updateType) {
      case 'insert':
        iterator = handleSparqlInsert(store, update, opts);
        break;
      case 'delete':
        iterator = handleSparqlDelete(store, update, opts);
        break;
      case 'insertdelete':
        iterator = handleSparqlInsertDelete(store, update, opts);
        break;
      default:
        throw new Error(`Unsupported SPARQL update type "${update.updateType}"`);
    }
    iterator.once('end', () => {
      remaining -= 1;
      if (remaining === 0) {
        emitter.emit('end');
      }
    });
  }
  return emitter;
};

module.exports.handleSparqlUpdate = handleSparqlUpdate;
