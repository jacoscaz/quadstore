
'use strict';

const _ = require('lodash');
const utils = require('./utils');
const debug = require('debug')('quadstore:quadstore');
const crypto = require('crypto');
const stream = require('stream');
const assert = require('assert');
const events = require('events');
const levelup = require('levelup');

/**
 * De(serialization) for LevelDB
 */
const valueEncoding = { encode: JSON.stringify, decode: JSON.parse };

/**
 *
 */
class QuadStore extends events.EventEmitter {

  constructor(pathOrLevel, opts) {
    super();
    if (_.isNil(opts)) opts = {};
    assert(_.isString(pathOrLevel) || utils.isLevel(pathOrLevel), 'The "path" argument is not a string nor a LevelUP instance.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    if (opts.db) assert(utils.isAbstractLevelDownClass(opts.db), 'The "opts.db" argument is not a subclass of AbstractLevelDOWN.');
    const store = this;
    store._db = utils.isLevel(pathOrLevel) ? pathOrLevel : levelup(pathOrLevel, { db: opts.db, valueEncoding });
    store._contextKey = opts.contextKey || 'graph';
    store._defaultContextValue = opts.defaultContextValue || '_DEFAULT_CONTEXT_';
    store._indexes = [];
    store._id = crypto.randomBytes(10).toString('hex');
    utils.defineReadOnlyProperty(store, 'boundary', opts.boundary || '\uDBFF\uDFFF');
    utils.defineReadOnlyProperty(store, 'separator', opts.separator || '\u0000\u0000');
    setImmediate(() => { store._initialize(); });
  }

  _initialize() {
    this.emit('ready');
  }

  static get valueEncoding() {
    return valueEncoding;
  }


  toString() {
    return this.toJSON();
  }

  toJSON() {
    return `[object ${this.constructor.name}::${this._id}]`;
  }

  //
  // CUSTOM INDEXES
  //

  _getIndex(name) {
    return _.find(this._indexes, index => index.name === name);
  }

  _setIndex(name, keygen) {
    this._indexes.push({ name, keygen });
  }

  registerIndex(name, keygen) {
    assert(_.isString(name), 'Invalid index name (not a string).');
    assert(_.isFunction(keygen), 'Invalid key generator (not a function).');
    assert(_.isNil(this._getIndex(name)), 'Invalid index name (duplicate name).');
    this._setIndex(name, keygen);
    return this;
  }

  getByIndex(name, opts, cb) {
    const store = this;
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isString(name), 'The "name" argument is not a string.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    const quads = [];
    function _getByIndex(resolve, reject) {
      store.getByIndexStream(name, opts)
        .on('data', (quad) => { quads.push(quad); })
        .on('end', () => { resolve(quads); })
        .on('error', (err) => { reject(err); });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_getByIndex);
    }
    _getByIndex(cb.bind(null, null), cb);
  }

  getByIndexStream(name, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isString(name), 'The "name" argument is not a string.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const levelOpts = {};
    if (_.isString(opts.gte)) levelOpts.gte = name + this.separator + opts.gte;
    if (_.isString(opts.lte)) levelOpts.lte = name + this.separator + opts.lte;
    if (_.isString(opts.gt)) levelOpts.gt = name + this.separator + opts.gt;
    if (_.isString(opts.lt)) levelOpts.lt = name + this.separator + opts.lt;
    if (_.isNumber(opts.limit)) levelOpts.limit = opts.limit;
    if (_.isBoolean(opts.reverse)) levelOpts.reverse = opts.reverse;
    const quadStream = this._db.createValueStream(levelOpts);
    if (opts.offset) {
      if (levelOpts.limit) {
        levelOpts.limit += opts.offset;
      }
      quadStream.pipe(this._createOffsetStream(opts.offset));
    }
    return quadStream;
  }

  // queryByIndex(name, opts) {
  //   deprecate('The queryByIndex() method is deprecated and will be removed in the next version of quadstore.');
  //   if (_.isNil(opts)) opts = {};
  //   assert(_.isObject(opts), 'The "opts" argument is not an object.');
  //   return new InitialQuery(this, this.getByIndexStream(name, opts));
  // }

  //
  // BASIC ACCESS
  //

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
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
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

  // query(matchTerms) {
  //   deprecate('The query() method is deprecated and will be removed in the next version of quadstore.');
  //   if (_.isNil(matchTerms)) matchTerms = {};
  //   assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
  //   return new InitialQuery(this, this.getStream(matchTerms));
  // }

  //
  // STREAMS
  //

  getStream(matchTerms, opts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const pattern = this._queryToPattern(matchTerms, {
      separator: this.separator,
      contextKey: this._contextKey,
    });
    const query = {
      gte: pattern,
      lte: pattern + this.boundary,
      limit: opts.limit
    };
    debug('getstream query %j', { ...query, offset: opts.offset });
    if (opts.offset && query.limit) {
      query.limit += opts.offset;
    }
    const valueStream = this._db.createValueStream(query);
    return opts.offset
      ? valueStream.pipe(this._createOffsetStream(opts.offset))
      : valueStream;
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
    function _getApproximateSize(resolve, reject) {
      const pattern = store._queryToPattern(matchTerms, {
        separator: store.separator,
        contextKey: store._contextKey,
      });
      store._db.db.approximateSize(pattern, pattern + store.boundary, (err, size) => {
        let approximateSize = Math.round(size / 128);
        err ? reject(err) : resolve(approximateSize);
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_getApproximateSize);
    }
    _getApproximateSize(cb.bind(null, null), cb);
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
      const importerStream = store._createImporterStream(store, opts);
      source.pipe(importerStream)
        .on('finish', () => { resolve(); })
        .on('error', (err) => {
          source.unpipe(importerStream);
          reject(err);
        });
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
      const removerStream = store._createRemoverStream(store, opts);
      source.pipe(removerStream)
        .on('finish', () => { resolve(); })
        .on('error', (err) => {
          source.unpipe(removerStream);
          reject(err);
        });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_delStream);
    }
    _delStream(cb.bind(null, null), cb);
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

  _isQuad(obj) {
    return _.isString(obj.subject)
      && _.isString(obj.predicate)
      && _.isString(obj.object)
      && _.isString(obj[this._contextKey]);
  }

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
    const separator = opts.separator;
    const contextKey = this._contextKey;
    if (!quad[contextKey]) {
      quad = {
        subject: quad.subject,
        predicate: quad.predicate,
        object: quad.object,
        [contextKey]: this._defaultContextValue
      };
    }
    const operations = [
      { /* SPOG */
        type,
        key: 'SPOG' + separator + quad.subject + separator + quad.predicate + separator + quad.object + separator + quad[contextKey],
        value: quad,
      },
      { /* POG  */
        type,
        key: 'POG' + separator + quad.predicate + separator + quad.object + separator + quad[contextKey] + separator + quad.subject,
        value: quad,
      },
      { /* OGS  */
        type,
        key: 'OGS' + separator + quad.object + separator + quad[contextKey] + separator + quad.subject + separator + quad.predicate,
        value: quad,
      },
      { /* GSP  */
        type,
        key: 'GSP' + separator + quad[contextKey] + separator + quad.subject + separator + quad.predicate + separator + quad.object,
        value: quad,
      },
      { /* GP   */
        type,
        key: 'GP' + separator + quad[contextKey] + separator + quad.predicate + separator + quad.subject + separator + quad.object,
        value: quad,
      },
      { /* OS   */
        type,
        key: 'OS' + separator + quad.object + separator + quad.subject + separator + quad.predicate + separator + quad[contextKey],
        value: quad,
      },
    ];
    if (indexes.length > 0) {
      for (let i = 0, index; i < indexes.length; i += 1) {
        index = indexes[i];
        operations.push({
          type,
          key: index.name + separator + index.keygen(quad) + separator + quad.subject + separator + quad.predicate + separator + quad.object + separator + quad[contextKey],
          value: quad
        });
      }
    }
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

  /**
   * Transforms a query into a matching pattern targeting
   * the appropriate index.
   * @param query
   * @returns {*}
   */
  _queryToPattern(query, opts) {
    const separator = opts.separator;
    const contextKey = opts.contextKey;
    let pattern;
    if (query.subject) {
      if (query.predicate) {
        if (query.object) {
          if (query[contextKey]) {
            pattern = 'SPOG' + separator + query.subject + separator + query.predicate + separator + query.object + separator + query[contextKey];
          } else {
            pattern = 'SPOG' + separator + query.subject + separator + query.predicate + separator + query.object + separator;
          }
        } else if (query[contextKey]) {
          pattern = 'GSP' + separator + query[contextKey] + separator + query.subject + separator + query.predicate + separator;
        } else {
          pattern = 'SPOG' + separator + query.subject + separator + query.predicate + separator;
        }
      } else if (query.object) {
        if (query[contextKey]) {
          pattern = 'OGS' + separator + query.object + separator + query[contextKey] + separator + query.subject + separator;
        } else {
          pattern = 'OS' + separator + query.object + separator + query.subject + separator;
        }
      } else if (query[contextKey]) {
        pattern = 'GSP' + separator + query[contextKey] + separator + query.subject + separator;
      } else {
        pattern = 'SPOG' + separator + query.subject + separator;
      }
    } else if (query.predicate) {
      if (query.object) {
        if (query[contextKey]) {
          pattern = 'POG' + separator + query.predicate + separator + query.object + separator + query[contextKey] + separator;
        } else {
          pattern = 'POG' + separator + query.predicate + separator + query.object + separator;
        }
      } else if (query[contextKey]) {
        pattern = 'GP' + separator + query[contextKey] + separator + query.predicate + separator;
      } else {
        pattern = 'POG' + separator + query.predicate + separator;
      }
    } else if (query.object) {
      if (query[contextKey]) {
        pattern = 'OGS' + separator + query.object + separator + query[contextKey] + separator;
      } else {
        pattern = 'OGS' + separator + query.object + separator;
      }
    } else if (query[contextKey]) {
      pattern = 'GSP' + separator + query[contextKey] + separator;
    } else {
      pattern = 'SPOG' + separator;
    }
    return pattern;
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

  /*
   * Offset stream
   */

  _createOffsetStream(skipQty) {
    let missing = skipQty;
    function pushTransform(quad, enc, cb) {
      this.push(quad);
      cb();
    }
    function skipTransform(quad, enc, cb) {
      if (missing === 0) {
        this._transform = pushTransform;
        pushTransform.call(this, quad, enc, cb);
      } else {
        missing -= 1;
        cb();
      }
    }
    return new stream.Transform({
      objectMode: true,
      transform: skipTransform
    });
  }

  /**
   * Remover stream
   */

  _createRemoverStream(opts) {
    const store = this;
    return new stream.Writable({
      objectMode: true,
      write(quad, enc, cb) {
        store._delput([quad], [], opts, cb);
      }
    });
  }

  /**
   * Importer stream
   */

  _createImporterStream(opts) {
    const store = this;
    return new stream.Writable({
      objectMode: true,
      write(quad, enc, cb) {
        store._delput([], [quad], opts, cb);
      }
    });
  }

}

module.exports = QuadStore;
