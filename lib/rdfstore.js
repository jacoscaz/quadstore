
'use strict';

const _ = require('lodash');
const n3u = require('n3').Util;
const utils = require('./utils');
const assert = require('assert');
const QuadStore = require('./quadstore');
const AsyncIterator = require('asynciterator');

function exportTerm(term, dataFactory) {
  if (term === '') {
    return dataFactory.defaultGraph();
  }
  if (n3u.isLiteral(term)) {
    const value = n3u.getLiteralValue(term);
    const datatype = n3u.getLiteralType(term);
    const language = n3u.getLiteralLanguage(term);
    return dataFactory.literal(value, language || (datatype && dataFactory.namedNode(datatype)) || null);
  }
  if (n3u.isBlank(term)) {
    return dataFactory.blankNode(term.slice(2));
  }
  if (n3u.isIRI(term)) {
    return dataFactory.namedNode(term);
  }
  throw new Error('Bad term ' + term + ', cannot export');
}

function importTerm(term) {
  switch (term.termType) {
    case 'Literal':
      if (term.language) return n3u.createLiteral(term.value, term.language);
      if (term.datatype) return n3u.createLiteral(term.value, importTerm(term.datatype));
      return n3u.createLiteral(term.value);
    case 'NamedNode':
      return term.value;
    case 'DefaultGraph':
      return term.value;
    case 'BlankNode':
      return '_:' + term.value;
    default:
      throw new Error('Unsupported termType ' + term.termType);
  }
}

class RdfStore extends QuadStore {

  constructor(path, opts) {
    assert(_.isObject(opts), 'Missing `opts` argument.');
    assert(_.isObject(opts.dataFactory), 'Missing `opts.dataFactory` property.');
    opts.contextKey = 'graph';
    super(path, opts);
    this._dataFactory = opts.dataFactory;
  }

  match(subject, predicate, object, graph) {
    const dataFactory = this._dataFactory;
    const readStream = this.createReadStream({
      subject: subject && importTerm(subject),
      predicate: predicate && importTerm(predicate),
      object: object && importTerm(object),
      graph: graph && importTerm(graph)
    });
    return new AsyncIterator.SimpleTransformIterator(readStream, {
      map(quad) {
        return dataFactory.quad(
          exportTerm(quad.subject, dataFactory),
          exportTerm(quad.predicate, dataFactory),
          exportTerm(quad.object, dataFactory),
          exportTerm(quad.graph, dataFactory)
        );
      }
    });
  }

  import(source, cb) {
    const store = this;
    utils.consume(source, (quad, consumeCb) => {
      if (!quad) { cb(); return; }
      store.put(quad, consumeCb);
    });
  }

  put(quad, cb) {
    QuadStore.prototype.put.call(this, {
      subject: importTerm(quad.subject),
      predicate: importTerm(quad.predicate),
      object: importTerm(quad.object),
      graph: importTerm(quad.graph)
    }, cb);
  }

}

module.exports = RdfStore;
