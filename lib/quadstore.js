
'use strict';

const _ = require('lodash');
const assert = require('assert');
const events = require('events');
const levelup = require('levelup');
const InitialQuery = require('./query/initial-query');

/**
 * De(serialization) for LevelDB
 */
const valueEncoding = { encode: JSON.stringify, decode: JSON.parse };

/**
 *
 */
class QuadStore extends events.EventEmitter {

  constructor(path, opts) {
    super();
    if (_.isNil(opts)) opts = {};
    assert(_.isString(path), 'The "path" argument is not a string.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    this._db = levelup(path, { db: opts.db, valueEncoding });
    this._boundary = '\uDBFF\uDFFF';
    this._separator = opts.separator || '\u0000\u0000';
    this._contextKey = opts.contextKey || 'graph';
  }

  //
  // BASIC ACCESS
  //

  put(quads, opts, cb) {
    const store = this;
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(quads), 'The "quads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    if (!Array.isArray(quads)) quads = [quads];
    const batch = _.flatMap(quads, store._createQuadToBatchIteratee({
      type: 'put',
      separator: store._separator,
      contextKey: store._contextKey,
    }));
    function _put(resolve, reject) {
      store._db.batch(batch, opts, (err) => {
        if (err) reject(err); else resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_put);
    }
    _put(cb.bind(null, null), cb);
  }

  del(quads, opts, cb) {
    const store = this;
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(quads), 'The "quads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    if (!Array.isArray(quads)) quads = [quads];
    const batch = _.flatMap(quads, store._createQuadToBatchIteratee({
      type: 'del',
      separator: store._separator,
      contextKey: store._contextKey,
    }));
    function _del(resolve, reject) {
      store._db.batch(batch, opts, (err) => {
        if (err) reject(err); else resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_del);
    }
    _del(cb.bind(null, null), cb);
  }

  _delput(oldQuads, newQuads, opts, cb) {
    const store = this;
    if (!Array.isArray(oldQuads)) oldQuads = [oldQuads];
    if (!Array.isArray(newQuads)) newQuads = [newQuads];
    const batch = [].concat(
      _.flatMap(oldQuads, store._createQuadToBatchIteratee({
        type: 'del',
        separator: store._separator,
        contextKey: store._contextKey,
      })),
      _.flatMap(newQuads, store._createQuadToBatchIteratee({
        type: 'put',
        separator: store._separator,
        contextKey: store._contextKey,
      }))
    );
    function _delput(resolve, reject) {
      store._db.batch(batch, opts, (err) => {
        if (err) reject(err); else resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_delput);
    }
    _delput(cb.bind(null, null), cb);
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
      store.createReadStream(matchTerms, opts)
        .on('data', (quad) => { quads.push(quad); })
        .on('end', () => { resolve(quads); })
        .on('error', (err) => { reject(err); });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_get);
    }
    _get(cb.bind(null, null), cb);
  }

  _getdelput(matchTerms, newQuads, opts, cb) {
    const store = this;
    function _getdelput(resolve, reject) {
      store.get(matchTerms, opts, (matchErr, oldQuads) => {
        if (matchErr) { reject(matchErr); return; }
        store._delput(oldQuads, newQuads, opts, (delputErr) => {
          if (delputErr) reject(delputErr); else resolve();
        });
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_getdelput);
    }
    _getdelput(cb.bind(null, null), cb);
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
    return Array.isArray(matchTermsOrOldQuads)
      ? this._delput(matchTermsOrOldQuads, newQuads, opts, cb)
      : this._getdelput(matchTermsOrOldQuads, newQuads, opts, cb);
  }

  query(matchTerms) {
    if (_.isNil(matchTerms)) matchTerms = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
    return new InitialQuery(this, this.createReadStream(matchTerms));
  }

  //
  // STREAMS
  //

  createReadStream(matchTerms, opts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const pattern = this._queryToPattern(matchTerms, {
      separator: this._separator,
      contextKey: this._contextKey,
    });
    return this._db.createValueStream({
      gte: pattern,
      lte: pattern + this._boundary,
      limit: opts.limit
    }, opts);
  }

  //
  // UTILS
  //

  getApproximateSize(query, cb) {
    const pattern = this._queryToPattern(query, {
      separator: this._separator,
      contextKey: this._contextKey,
    });
    if (!_.isFunction(this._db.db.approximateSize)) return cb(null, 0);
    return this._db.db.approximateSize(pattern, pattern + this._boundary, cb);
  }

  close(cb) {
    const store = this;
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    function _close(resolve, reject) {
      store._db.close((err) => {
        if (err) reject(err); else resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_close);
    }
    _close(cb.bind(null, null), cb);
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
    const separator = opts.separator;
    const contextKey = opts.contextKey;
    return [
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

  _createEqualComparator(termNames) {
    if (!termNames) termNames = ['subject', 'predicate', 'object', this._contextKey];
    return function equalComparator(quadA, quadB) {
      return termNames.reduce((eq, termName) => {
        return eq && quadA[termName] === quadB[termName];
      }, true);
    };
  }

  _createOrderComparator(termNames) {
    if (!termNames) termNames = ['subject', 'predicate', 'object', this._contextKey];
    return function orderComparator(quadA, quadB) {
      function _compare(_quadA, _quadB, _termNames) {
        if (_termNames.length === 0) {
          return 0;
        }
        const termName = _termNames[0];
        if (_quadA[termName] === _quadB[termName]) {
          return _compare(_quadA, _quadB, _termNames.slice(1));
        }
        return _quadA[termName] < _quadB[termName] ? -1 : 1;
      }
      return _compare(quadA, quadB, termNames);
    };
  }

}

module.exports = QuadStore;
