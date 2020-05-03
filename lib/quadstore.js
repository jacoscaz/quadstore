
'use strict';

const _ = require('./utils/lodash');
const utils = require('./utils');
const assert = require('assert');
const events = require('events');
const encode = require('encoding-down');
const levelup = require('levelup');
const get = require('./get');
const search = require('./search');
const AsyncIterator = require('asynciterator');

/**
 *
 */
class QuadStore extends events.EventEmitter {

  /*
   * ==========================================================================
   *                           STORE LIFECYCLE
   * ==========================================================================
   */

  constructor(opts) {
    super();
    assert(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(
      utils.isAbstractLevelDOWNInstance(opts.backend),
      'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN',
    );
    const store = this;
    store._abstractLevelDOWN = opts.backend;
    store._db = levelup(encode(store._abstractLevelDOWN, {valueEncoding: 'json'}));
    store._contextKey = opts.contextKey || 'graph';
    store._defaultContextValue = opts.defaultContextValue || '_DEFAULT_CONTEXT_';
    store._indexes = [];
    store._id = utils.nanoid();
    utils.defineReadOnlyProperty(store, 'boundary', opts.boundary || '\uDBFF\uDFFF');
    utils.defineReadOnlyProperty(store, 'separator', opts.separator || '\u0000\u0000');
    (opts.indexes || utils.genDefaultIndexes(this._contextKey))
      .forEach((index) => this._addIndex(index));
    setImmediate(() => { store._initialize(); });
  }

  _initialize() {
    this.emit('ready');
  }

  close(cb) {
    const store = this;
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    function _close(resolve, reject) {
      store._db.close((err) => {
        err ? reject(err) : resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_close);
    }
    _close(cb.bind(null, null), cb);
  }

  /*
   * ==========================================================================
   *                           STORE SERIALIZATION
   * ==========================================================================
   */

  toString() {
    return this.toJSON();
  }

  toJSON() {
    return `[object ${this.constructor.name}::${this._id}]`;
  }

  /*
   * ==========================================================================
   *                                  INDEXES
   * ==========================================================================
   */

  _addIndex(terms) {
    assert(utils.hasAllTerms(terms, this._contextKey), 'Invalid index (bad terms).');
    const name = terms.map(t => t.charAt(0).toUpperCase()).join('');
    this._indexes.push({
      terms,
      name,
      getKey: eval(
        '(quad) => `'
          + name + this.separator
          + terms.map(term => `\${quad['${term}']}${this.separator}`).join('')
          + '`'
      ),
    });
  }

  /*
   * ==========================================================================
   *                            NON-STREAMING API
   * ==========================================================================
   */

  put(quads, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(quads), 'The "quads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    const maybePromise = this._delput([], quads, opts, cb);
    if (utils.isPromise(maybePromise)) return maybePromise;
  }

  del(matchTermsOrOldQuads, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTermsOrOldQuads), 'The "matchTermsOrOldQuads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    const maybePromise = (Array.isArray(matchTermsOrOldQuads) || this._isQuad(matchTermsOrOldQuads))
      ? this._delput(matchTermsOrOldQuads, [], opts, cb)
      : this._getdelput(matchTermsOrOldQuads, [], opts, cb);
    if (utils.isPromise(maybePromise)) return maybePromise;
  }

  /**
   * Returns all quads matching the provided terms.
   * @param matchTerms
   * @param cb
   */
  get(matchTerms, opts, cb) {
    const store = this;
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isFunction(matchTerms)) {
      cb = matchTerms;
      opts = {};
      matchTerms = {};
    }
    if (_.isNil(opts)) opts = {};
    if (_.isNil(matchTerms)) matchTerms = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    const quads = [];
    function _get(resolve, reject) {
      store.getStream(matchTerms, opts)
        .on('data', (quad) => { quads.push(quad); })
        .on('end', () => { resolve(quads); })
        .on('error', (err) => { reject(err); });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_get);
    }
    _get(cb.bind(null, null), cb);
  }

  search(patterns, filters, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(patterns), 'The "patterns" argument is not an array.');
    assert(_.isArray(filters), 'The "filters" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    const bindings = [];
    const _search = (resolve, reject) => {
      this.searchStream(patterns, filters, opts)
        .on('data', (binding) => { bindings.push(binding); })
        .on('end', () => { resolve(bindings); })
        .on('error', (err) => { reject(err); });
    };
    if (!_.isFunction(cb)) {
      return new Promise(_search);
    }
    _search(cb.bind(null, null), cb);
  }

  patch(matchTermsOrOldQuads, newQuads, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isFunction(newQuads)) {
      cb = newQuads;
      opts = {};
      newQuads = [];
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTermsOrOldQuads), 'Invalid type of "matchTermsOrOldQuads" argument.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    const maybePromise = (Array.isArray(matchTermsOrOldQuads) || this._isQuad(matchTermsOrOldQuads))
      ? this._delput(matchTermsOrOldQuads, newQuads, opts, cb)
      : this._getdelput(matchTermsOrOldQuads, newQuads, opts, cb);
    if (utils.isPromise(maybePromise)) return maybePromise;
  }

  /*
   * ==========================================================================
   *                                COUNTING API
   * ==========================================================================
   */

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
    return get.getApproximateSize(matchTerms, opts, this, cb);
  }

  /*
   * ==========================================================================
   *                            STREAMING API
   * ==========================================================================
   */

  getStream(matchTerms, opts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return get.getStream(matchTerms, opts, this);
  }

  searchStream(patterns, filters, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(patterns), 'The "patterns" argument is not an array.');
    assert(_.isArray(filters), 'The "filters" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return search.searchStream(this, patterns, filters, opts);
  }

  putStream(source, opts, cb) {
    const store = this;
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    function _putStream(resolve, reject) {
      AsyncIterator.wrap(source).transform((quad, cb) => {
        store._delput([], [quad], opts, cb);
      })
        .on('data', utils.noop)
        .on('end', resolve)
        .on('error', reject);
    }
    if (!_.isFunction(cb)) {
      return new Promise(_putStream);
    }
    _putStream(cb.bind(null, null), cb);
  }

  delStream(source, opts, cb) {
    const store = this;
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    function _delStream(resolve, reject) {
      AsyncIterator.wrap(source).transform((quad, cb) => {
        store._delput([quad], [], opts, cb);
      })
        .on('data', utils.noop)
        .on('end', resolve)
        .on('error', reject);
    }
    if (!_.isFunction(cb)) {
      return new Promise(_delStream);
    }
    _delStream(cb.bind(null, null), cb);
  }



  _isQuad(obj) {
    return _.isString(obj.subject)
      && _.isString(obj.predicate)
      && _.isString(obj.object)
      && _.isString(obj[this._contextKey]);
  }

  /*
   * ==========================================================================
   *                            LOW-LEVEL DB HELPERS
   * ==========================================================================
   */

  _delput(oldQuads, newQuads, opts, cb) {
    const store = this;
    if (!Array.isArray(oldQuads)) oldQuads = [oldQuads];
    if (!Array.isArray(newQuads)) newQuads = [newQuads];
    const batch = [].concat(
      _.flatMap(oldQuads, store._createQuadToBatchIteratee({
        type: 'del',
        separator: store.separator,
        contextKey: store._contextKey,
      })),
      _.flatMap(newQuads, store._createQuadToBatchIteratee({
        type: 'put',
        separator: store.separator,
        contextKey: store._contextKey,
      }))
    );
    function __delput(resolve, reject) {
      store._db.batch(batch, opts, (err) => {
        if (err) reject(err); else resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(__delput);
    }
    __delput(cb.bind(null, null), cb);
  }

  _getdelput(matchTerms, newQuads, opts, cb) {
    const store = this;
    function __getdelput(resolve, reject) {
      store.get(matchTerms, opts, (matchErr, oldQuads) => {
        if (matchErr) { reject(matchErr); return; }
        store._delput(oldQuads, newQuads, opts, (delputErr) => {
          if (delputErr) reject(delputErr); else resolve();
        });
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(__getdelput);
    }
    __getdelput(cb.bind(null, null), cb);
  }

  /**
   * Transforms a quad into a batch of either put or del
   * operations, one per each of the six indexes.
   * @param quad
   * @param opts
   * @returns {}
   */
  _quadToBatch(quad, opts) {
    const type = opts.type;
    const indexes = this._indexes;
    const contextKey = this._contextKey;
    if (!quad[contextKey]) {
      quad = {
        subject: quad.subject,
        predicate: quad.predicate,
        object: quad.object,
        [contextKey]: this._defaultContextValue,
      };
    }
    const operations = indexes.map(i => ({
        type,
        key: i.getKey(quad),
        value: quad,
    }));
    return operations;
  }

  /**
   * Helper function - curries quadToBatch().
   * @param opts
   * @returns {batchifier}
   */
  _createQuadToBatchIteratee(opts) {
    const store = this;
    return function quadToBatchIteratee(quad) {
      return store._quadToBatch(quad, opts);
    };
  }

  _createQuadComparator(termNamesA, termNamesB) {
    if (!termNamesA) termNamesA = ['subject', 'predicate', 'object', this._contextKey];
    if (!termNamesB) termNamesB = termNamesA.slice();
    if (termNamesA.length !== termNamesB.length) throw new Error('Different lengths');
    return function comparator(quadA, quadB) {
      for (let i = 0; i <= termNamesA.length; i += 1) {
        if (i === termNamesA.length) return 0;
        else if (quadA[termNamesA[i]] < quadB[termNamesB[i]]) return -1;
        else if (quadA[termNamesA[i]] > quadB[termNamesB[i]]) return 1;
      }
    };
  }

}

module.exports = QuadStore;
