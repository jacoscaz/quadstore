
'use strict';

const _ = require('lodash');
const n3u = require('n3').Util;
const utils = require('./utils');
const assert = require('assert');
const events = require('events');
const QuadStore = require('./quadstore');
const InitialQuery = require('./query/initial-query');
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

  /**
   * RDF/JS.Source.match()
   * @param subject
   * @param predicate
   * @param object
   * @param graph
   * @returns {*}
   */
  match(subject, predicate, object, graph) {
    const matchTerms = { subject, predicate, object, graph };
    return this.createReadStream(matchTerms);
  }

  /**
   * RDF/JS.Sink.import()
   * @param source
   * @param opts
   * @returns {*|EventEmitter}
   */
  import(source, opts) {
    const store = this;
    const emitter = new events.EventEmitter();
    setImmediate(() => {
      utils.consume(source, (quad, consumeCb) => {
        if (!quad) { emitter.emit('end'); return; }
        store.put(quad, opts, consumeCb);
      });
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
    const store = this;
    const emitter = new events.EventEmitter();
    setImmediate(() => {
      utils.consume(source, (quad, consumeCb) => {
        if (!quad) { emitter.emit('end'); return; }
        store.del(quad, opts, consumeCb);
      });
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
    const store = this;
    if (!Array.isArray(quads)) quads = [quads];
    QuadStore.prototype.put.call(this, quads.map(quad => store._importQuad(quad)), opts, cb);
  }

  del(quads, opts, cb) {
    const store = this;
    if (!Array.isArray(quads)) quads = [quads];
    QuadStore.prototype.del.call(this, quads.map(quad => store._importQuad(quad)), opts, cb);
  }

  delput(oldQuads, newQuads, opts, cb) {
    const store = this;
    if (!Array.isArray(oldQuads)) oldQuads = [oldQuads];
    if (!Array.isArray(newQuads)) newQuads = [newQuads];
    QuadStore.prototype.delput.call(this, oldQuads.map(quad => store._importQuad(quad)), newQuads.map(quad => store._importQuad(quad)), opts, cb);
  }

  createReadStream(matchTerms, opts) {
    const store = this;
    const importedMatchTerms = {};
    if (matchTerms.subject) importedMatchTerms.subject = this._importTerm(matchTerms.subject);
    if (matchTerms.predicate) importedMatchTerms.predicate = this._importTerm(matchTerms.predicate);
    if (matchTerms.object) importedMatchTerms.object = this._importTerm(matchTerms.object);
    if (matchTerms.graph) importedMatchTerms.graph = this._importTerm(matchTerms.graph);
    const readStream = QuadStore.prototype.createReadStream.call(this, importedMatchTerms, opts);
    return new AsyncIterator.SimpleTransformIterator(readStream, {
      map: quad => store._exportQuad(quad)
    });
  }

  query(matchTerms) {
    return new InitialQuery(this, this.createReadStream(matchTerms));
  }

  _exportTerm(term) {
    let exported;
    if (term === defaultGraphTermValue) {
      exported = this._dataFactory.defaultGraph();
    } else if (n3u.isLiteral(term)) {
      const value = n3u.getLiteralValue(term);
      const datatype = n3u.getLiteralType(term);
      const language = n3u.getLiteralLanguage(term);
      exported = this._dataFactory.literal(value, language || (datatype && this._dataFactory.namedNode(datatype)) || null);
    } else if (n3u.isBlank(term)) {
      exported = this._dataFactory.blankNode(term.slice(2));
    } else if (n3u.isIRI(term)) {
      exported = this._dataFactory.namedNode(term);
    } else {
      throw new Error('Bad term ' + term + ', cannot export');
    }
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
    return this._dataFactory.quad(
      this._exportTerm(quad.subject),
      this._exportTerm(quad.predicate),
      this._exportTerm(quad.object),
      this._exportTerm(quad.graph)
    );
  }

  _createEqualComparator(termNames) {
    const store = this;
    if (!termNames) termNames = ['subject', 'predicate', 'object', 'graph'];
    return function equalComparator(quadA, quadB) {
      return termNames.reduce((eq, termName) => {
        return eq && store._importTerm(quadA[termName]) === store._importTerm(quadB[termName]);
      }, true);
    };
  }

  _createOrderComparator(termNames) {
    const store = this;
    if (!termNames) termNames = ['subject', 'predicate', 'object', 'graph'];
    return function orderComparator(quadA, quadB) {
      function _compare(quadA, quadB, termNames) {
        if (termNames.length === 0) {
          return 0;
        }
        const termName = termNames[0];
        const termValueA = store._importTerm(quadA[termName]);
        const termValueB = store._importTerm(quadB[termName]);
        if (termValueA === termValueB) {
          return _compare(quadA, quadB, termNames.slice(1));
        }
        return termValueA < termValueB ? -1 : 1;
      }
      return _compare(quadA, quadB, termNames);
    };
  }

}

module.exports = RdfStore;
