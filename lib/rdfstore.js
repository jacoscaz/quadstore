
'use strict';

const _ = require('lodash');
const n3 = require('n3');
const utils = require('./utils');
const debug = require('debug')('quadstore:rdfstore');
const assert = require('assert');
const events = require('events');
const QuadStore = require('./quadstore');
const HttpServer = require('./http/server');
const SparqlEngine = require('@comunica/actor-init-sparql-rdfjs').newEngine;
const serialization = require('./rdf/serialization');

class RdfStore extends QuadStore {

  constructor(abstractLevelDOWN, opts) {
    if (_.isNil(opts)) {
      opts = {};
    }
    assert(_.isObject(opts), 'Invalid `opts` arguments.');
    const superOpts = _.extend(
      { defaultContextValue: 'urn:quadstore:dg' },
      opts,
      { contextKey: 'graph' }
    );
    super(abstractLevelDOWN, superOpts);
    const store = this;
    store._httpPort = opts.httpPort || '8883';
    store._httpAddr = opts.httpAddr || '127.0.0.1';
    store._httpBaseUrl = opts.httpBaseUrl || 'http://127.0.0.1:8883';
    store._sparqlEngine = SparqlEngine();
    store._dataFactory = opts.dataFactory || n3.DataFactory;
  }

  _initialize() {
    const store = this;
    const server = store._httpServer = new HttpServer(this, {
      baseUrl: store._httpBaseUrl
    });
    server.listen(store._httpPort, store._httpAddr, (err) => {
      if (err) {
        store.emit('error', utils.wrapError(err, 'Cannot start listening. Could not initialize store.'));
        return;
      }
      store.emit('ready');
    });
  }

  sparql(query, format, cb) {
    if (typeof(format) === 'function') {
      cb = format;
      format = undefined;
    }
    debug(`sparql query: ${query}`);
    let queryPromise = this._sparqlEngine.query(query, {sources: [{type: 'rdfjsSource', value: this}]});
    if (format) {
      if (format === 'comunica') { 
        // Do nothing
      } else {
        queryPromise = queryPromise
          .then(result => this._sparqlEngine.resultToString(result, format))
          .catch(err => Promise.reject(utils.wrapError(
            err, `Cannot serialize results of query "${query}" to format "${format}".`
          )))
          .then(result => result.data);
      }
    } else {
      queryPromise = queryPromise.then((result) => {
        if (result.type !== 'bindings') {
          return Promise.reject(new Error(`Unsupported result type ${result.type}.`));
        }
        return utils.createIteratorStream(result.bindingsStream)
          .pipe(utils.createMapToObjTransformStream());
      });
    }
    if (typeof(cb) !== 'function') {
      return queryPromise;
    }
    queryPromise.then(cb.bind(null, null)).catch(cb);
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
      if (err) emitter.emit('error', err);
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
    if (matchTerms.graph) importedMatchTerms.graph = this._importTerm(matchTerms.graph, true);
    return QuadStore.prototype.getStream.call(this, importedMatchTerms, opts)
      .pipe(this._createQuadDeserializerStream());
  }

  getApproximateCount(matchTerms, opts, cb) {
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
    if (matchTerms.graph) importedMatchTerms.graph = this._importTerm(matchTerms.graph, true);
    return QuadStore.prototype.getApproximateCount.call(this, importedMatchTerms, opts, cb);
  }

  getByIndexStream(name, opts) {
    return QuadStore.prototype.getByIndexStream.call(this, name, opts)
      .pipe(this._createQuadDeserializerStream());
  }

  close(cb) {
    const store = this;
    function _close(resolve, reject) {
      // store._fragmentsClient.abortAll();
      store._httpServer.terminate((serverErr) => {
        if (serverErr) { reject(serverErr); return; }
        QuadStore.prototype.close.call(store, (storeErr) => {
          if (storeErr) { reject(storeErr); return; }
          resolve();
        });
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_close);
    }
    _close(cb.bind(null, null), cb);
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

  _exportTerm(term, isGraph) {
    return serialization.exportTerm(term, isGraph, this._defaultContextValue, this._dataFactory);
  }

  _importTerm(term, isGraph) {
    return serialization.importTerm(term, isGraph, this._defaultContextValue);
  }

  _importQuad(quad) {
    return serialization.importQuad(quad, this._defaultContextValue);
  }

  _exportQuad(quad) {
    return serialization.exportQuad(quad, this._defaultContextValue, this._dataFactory);
  }

  _exportTerms(terms) {
    return serialization.exportTerms(terms, this._defaultContextValue, this._dataFactory);
  }

  _createQuadSerializerStream() {
    return serialization.createQuadImporterStream(this._defaultContextValue);
  }

  _createQuadDeserializerStream() {
    return serialization.createQuadExporterStream(this._defaultContextValue, this._dataFactory);
  }

  _createTermsDeserializerStream() {
    return serialization.createTermsExporterStream(this._defaultContextValue, this._dataFactory);
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
