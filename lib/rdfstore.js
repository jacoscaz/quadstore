
'use strict';

const _ = require('lodash');
const n3u = require('n3').Util;
const utils = require('./utils');
const stream = require('stream');
const assert = require('assert');
const events = require('events');
const QuadStore = require('./quadstore');

function createExportStream(store) {
  return new stream.Transform({
    objectMode: true,
    transform(quad, enc, cb) {
      this.push(store._exportQuad(quad));
      cb();
    }
  });
}

const defaultGraphTermValue = 'DEFAULT_GRAPH';

class RdfStore extends QuadStore {

  constructor(path, opts) {
    if (_.isNil(opts)) opts = {};
    super(path, _.extend({}, opts, { contextKey: 'graph' }));
    assert(_.isObject(opts.dataFactory), 'Missing "opts.dataFactory" property.');
    this.dataFactory = opts.dataFactory;
  }

  static get valueEncoding() {
    return QuadStore.valueEncoding;
  }

  /**
   * RDF/JS.Source.match()
   * @param subject
   * @param predicate
   * @param object
   * @param graph
   * @returns {*}
   */
  match(subject, predicate, object, graph) {
    if (!_.isNil(subject)) assert(_.isString(subject.termType), 'The "subject" argument is not an Term.');
    if (!_.isNil(predicate)) assert(_.isString(predicate.termType), 'The "predicate" argument is not an Term.');
    if (!_.isNil(object)) assert(_.isString(object.termType), 'The "object" argument is not an Term.');
    if (!_.isNil(graph)) assert(_.isString(graph.termType), 'The "graph" argument is not an Term.');
    const matchTerms = { subject, predicate, object, graph };
    return this.getStream(matchTerms);
  }

  /**
   * RDF/JS.Sink.import()
   * @param source
   * @param opts
   * @returns {*|EventEmitter}
   */
  import(source, opts) {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const emitter = new events.EventEmitter();
    this.putStream(source, opts, (err) => {
      if (err) emitter.emit('error', err);
      else emitter.emit('end');
    });
    return emitter;
  }

  /**
   * RDF/JS.Store.remove()
   * @param source
   * @param opts
   * @returns {*|EventEmitter}
   */
  remove(source, opts) {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const emitter = new events.EventEmitter();
    this.delStream(source, opts, (err) => {
      if (err) emitter.emit('error', err)
      else emitter.emit('end');
    });
    return emitter;
  }

  /**
   * RDF/JS.Store.removeMatches()
   * @param subject
   * @param predicate
   * @param object
   * @param graph
   * @returns {*}
   */
  removeMatches(subject, predicate, object, graph) {
    const source = this.match(subject, predicate, object, graph);
    return this.remove(source);
  }

  /**
   * RDF/JS.Store.deleteGraph()
   * @param graph
   * @returns {*}
   */
  deleteGraph(graph) {
    return this.removeMatches(null, null, null, graph);
  }

  getStream(matchTerms, opts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const importedMatchTerms = {};
    if (matchTerms.subject) importedMatchTerms.subject = this._importTerm(matchTerms.subject);
    if (matchTerms.predicate) importedMatchTerms.predicate = this._importTerm(matchTerms.predicate);
    if (matchTerms.object) importedMatchTerms.object = this._importTerm(matchTerms.object);
    if (matchTerms.graph) importedMatchTerms.graph = this._importTerm(matchTerms.graph);
    return QuadStore.prototype.getStream.call(this, importedMatchTerms, opts)
      .pipe(createExportStream(this));
  }

  getApproximateSize(matchTerms, opts, cb) {
    const store = this;
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const importedMatchTerms = {};
    if (matchTerms.subject) importedMatchTerms.subject = this._importTerm(matchTerms.subject);
    if (matchTerms.predicate) importedMatchTerms.predicate = this._importTerm(matchTerms.predicate);
    if (matchTerms.object) importedMatchTerms.object = this._importTerm(matchTerms.object);
    if (matchTerms.graph) importedMatchTerms.graph = this._importTerm(matchTerms.graph);
    return QuadStore.prototype.getApproximateSize.call(this, importedMatchTerms, opts, cb);
  }

  getByIndexStream(name, opts) {
    return QuadStore.prototype.getByIndexStream.call(this, name, opts)
      .pipe(createExportStream(this));
  }

  _delput(oldQuads, newQuads, opts, cb) {
    const store = this;
    if (!Array.isArray(oldQuads)) oldQuads = [oldQuads];
    if (!Array.isArray(newQuads)) newQuads = [newQuads];
    return QuadStore.prototype._delput.call(this, oldQuads.map(quad => store._importQuad(quad)), newQuads.map(quad => store._importQuad(quad)), opts, cb);
  }

  _isQuad(obj) {
    return QuadStore.prototype._isQuad.call(this, obj)
      && _.isFunction(obj.equals);
  }

  _exportTerm(term) {
    let exported;
    if (term === defaultGraphTermValue) {
      exported = this.dataFactory.defaultGraph();
    } else if (n3u.isLiteral(term)) {
      const value = n3u.getLiteralValue(term);
      const datatype = n3u.getLiteralType(term);
      const language = n3u.getLiteralLanguage(term);
      exported = this.dataFactory.literal(value, language || (datatype && this.dataFactory.namedNode(datatype)) || null);
    } else if (n3u.isBlank(term)) {
      exported = this.dataFactory.blankNode(term.slice(2));
    } else if (n3u.isIRI(term)) {
      exported = this.dataFactory.namedNode(term);
    } else {
      throw new Error('Bad term ' + term + ', cannot export');
    }
    exported._serializedValue = term;
    return exported;
  }

  _importTerm(term) {
    switch (term.termType) {
      case 'Literal':
        if (term.language) return n3u.createLiteral(term.value, term.language);
        if (term.datatype) return n3u.createLiteral(term.value, this._importTerm(term.datatype));
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

  _importQuad(quad) {
    return {
      subject: this._importTerm(quad.subject),
      predicate: this._importTerm(quad.predicate),
      object: this._importTerm(quad.object),
      graph: this._importTerm(quad.graph)
    };
  }

  _exportQuad(quad) {
    return this.dataFactory.quad(
      this._exportTerm(quad.subject),
      this._exportTerm(quad.predicate),
      this._exportTerm(quad.object),
      this._exportTerm(quad.graph)
    );
  }

  _createQuadComparator(termNamesA, termNamesB) {
    if (!termNamesA) termNamesA = ['subject', 'predicate', 'object', this._contextKey];
    if (!termNamesB) termNamesB = termNamesA.slice();
    if (termNamesA.length !== termNamesB.length) throw new Error('Different lengths');
    return function orderComparator(quadA, quadB) {
      for (let i = 0; i <= termNamesA.length; i += 1) {
        if (i === termNamesA.length) return 0;
        else if (quadA[termNamesA[i]]._serializedValue < quadB[termNamesB[i]]._serializedValue) return -1;
        else if (quadA[termNamesA[i]]._serializedValue > quadB[termNamesB[i]]._serializedValue) return 1;
      }
    };
  }

}

module.exports = RdfStore;
