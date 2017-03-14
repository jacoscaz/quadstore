
'use strict';

const _ = require('lodash');
const n3u = require('n3').Util;
const utils = require('./utils');
const assert = require('assert');
const QuadStore = require('./quadstore');
const AsyncIterator = require('asynciterator');

const defaultGraphTermValue = 'DEFAULT_GRAPH';

class RdfStore extends QuadStore {

  constructor(path, opts) {
    assert(_.isObject(opts), 'Missing `opts` argument.');
    assert(_.isObject(opts.dataFactory), 'Missing `opts.dataFactory` property.');
    opts.contextKey = 'graph';
    super(path, opts);
    this._dataFactory = opts.dataFactory;
  }

  match(subject, predicate, object, graph) {
    const matchTerms = { subject, predicate, object, graph };
    return this.createReadStream(matchTerms);
  }

  import(source, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = null;
    }
    const store = this;
    utils.consume(source, (quad, consumeCb) => {
      if (!quad) { cb(); return; }
      store.put(quad, opts, consumeCb);
    });
  }

  get(matchTerms, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = null;
    }
    const quads = [];
    this.createReadStream(matchTerms, opts)
      .on('data', (quad) => { quads.push(quad); })
      .on('end', () => { cb(null, quads); })
      .on('error', (err) => { cb(err); });
  }

  put(quads, opts, cb) {
    if (!Array.isArray(quads)) quads = [quads];
    QuadStore.prototype.put.call(this, quads.map(RdfStore._importQuad), opts, cb);
  }

  del(quads, opts, cb) {
    if (!Array.isArray(quads)) quads = [quads];
    QuadStore.prototype.del.call(this, quads.map(RdfStore._importQuad), opts, cb);
  }

  delput(oldQuads, newQuads, opts, cb) {
    if (!Array.isArray(oldQuads)) oldQuads = [oldQuads];
    if (!Array.isArray(newQuads)) newQuads = [newQuads];
    QuadStore.prototype.delput.call(this, oldQuads.map(RdfStore._importQuad), newQuads.map(RdfStore._importQuad), opts, cb);
  }

  createReadStream(matchTerms, opts) {
    const dataFactory = this._dataFactory;
    const importedMatchTerms = {};
    if (matchTerms.subject) importedMatchTerms.subject = RdfStore._importTerm(matchTerms.subject);
    if (matchTerms.predicate) importedMatchTerms.predicate = RdfStore._importTerm(matchTerms.predicate);
    if (matchTerms.object) importedMatchTerms.object = RdfStore._importTerm(matchTerms.object);
    if (matchTerms.graph) importedMatchTerms.graph = RdfStore._importTerm(matchTerms.graph);
    const readStream = QuadStore.prototype.createReadStream.call(this, importedMatchTerms, opts);
    return new AsyncIterator.SimpleTransformIterator(readStream, {
      map: quad => RdfStore._exportQuad(quad, dataFactory)
    });
  }

  static _exportTerm(term, dataFactory) {
    if (term === defaultGraphTermValue) {
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

  static _importTerm(term) {
    switch (term.termType) {
      case 'Literal':
        if (term.language) return n3u.createLiteral(term.value, term.language);
        if (term.datatype) return n3u.createLiteral(term.value, RdfStore._importTerm(term.datatype));
        return n3u.createLiteral(term.value);
      case 'NamedNode':
        return term.value;
      case 'DefaultGraph':
        return defaultGraphTermValue;
      case 'BlankNode':
        return '_:' + term.value;
      default:
        throw new Error('Unsupported termType ' + term.termType);
    }
  }

  static _importQuad(quad) {
    return {
      subject: RdfStore._importTerm(quad.subject),
      predicate: RdfStore._importTerm(quad.predicate),
      object: RdfStore._importTerm(quad.object),
      graph: RdfStore._importTerm(quad.graph)
    };
  }

  static _exportQuad(quad, dataFactory) {
    return dataFactory.quad(
      RdfStore._exportTerm(quad.subject, dataFactory),
      RdfStore._exportTerm(quad.predicate, dataFactory),
      RdfStore._exportTerm(quad.object, dataFactory),
      RdfStore._exportTerm(quad.graph, dataFactory)
    );
  }

}

module.exports = RdfStore;
