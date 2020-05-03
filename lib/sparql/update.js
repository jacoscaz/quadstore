
const { EventEmitter } = require('events');
const AsyncIterator = require('asynciterator');

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
