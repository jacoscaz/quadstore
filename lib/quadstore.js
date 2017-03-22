
'use strict';

const _ = require('lodash');
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
    if (!opts) opts = {};
    this._db = levelup(path, { db: opts.db, valueEncoding });
    this._boundary = '\uDBFF\uDFFF';
    this._separator = opts.separator || '\u0000\u0000';
    this._contextKey = opts.contextKey || 'context';
  }

  //
  // BASIC ACCESS
  //

  put(quads, opts, cb) {

    const store = this;

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

  delput(oldQuads, newQuads, opts, cb) {

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
      opts = null;
    }

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

  getdelput(matchTerms, newQuads, opts, cb) {

    const store = this;

    if (_.isFunction(newQuads)) {
      cb = newQuads;
      newQuads = [];
    }
    if (_.isFunction(opts)) {
      cb = opts;
      opts = null;
    }

    function _getdelput(resolve, reject) {
      store.get(matchTerms, opts, (matchErr, oldQuads) => {
        if (matchErr) { reject(matchErr); return; }
        store.delput(oldQuads, newQuads, opts, (delputErr) => {
          if (delputErr) reject(delputErr); else resolve();
        });
      });
    }

    if (!_.isFunction(cb)) {
      return new Promise(_getdelput);
    }

    _getdelput(cb.bind(null, null), cb);
  }

  query(matchTerms) {
    return new InitialQuery(this, this.createReadStream(matchTerms));
  }

  //
  // STREAMS
  //

  createReadStream(query, opts) {
    const pattern = this._queryToPattern(query, {
      separator: this._separator,
      contextKey: this._contextKey,
    });
    return this._db.createValueStream({
      gte: pattern,
      lte: pattern + this._boundary,
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
      { /* SPOC */
        type,
        key: 'SPOC' + separator + quad.subject + separator + quad.predicate + separator + quad.object + separator + quad[contextKey],
        value: quad,
      },
      { /* POC  */
        type,
        key: 'POC' + separator + quad.predicate + separator + quad.object + separator + quad[contextKey] + separator + quad.subject,
        value: quad,
      },
      { /* OCS  */
        type,
        key: 'OCS' + separator + quad.object + separator + quad[contextKey] + separator + quad.subject + separator + quad.predicate,
        value: quad,
      },
      { /* CSP  */
        type,
        key: 'CSP' + separator + quad[contextKey] + separator + quad.subject + separator + quad.predicate + separator + quad.object,
        value: quad,
      },
      { /* CP   */
        type,
        key: 'CP' + separator + quad[contextKey] + separator + quad.predicate + separator + quad.subject + separator + quad.object,
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
            pattern = 'SPOC' + separator + query.subject + separator + query.predicate + separator + query.object + separator + query[contextKey];
          } else {
            pattern = 'SPOC' + separator + query.subject + separator + query.predicate + separator + query.object + separator;
          }
        } else if (query[contextKey]) {
          pattern = 'CSP' + separator + query[contextKey] + separator + query.subject + separator + query.predicate + separator;
        } else {
          pattern = 'SPOC' + separator + query.subject + separator + query.predicate + separator;
        }
      } else if (query.object) {
        if (query[contextKey]) {
          pattern = 'OCS' + separator + query.object + separator + query[contextKey] + separator + query.subject + separator;
        } else {
          pattern = 'OS' + separator + query.object + separator + query.subject + separator;
        }
      } else if (query[contextKey]) {
        pattern = 'CSP' + separator + query[contextKey] + separator + query.subject + separator;
      } else {
        pattern = 'SPOC' + separator + query.subject + separator;
      }
    } else if (query.predicate) {
      if (query.object) {
        if (query[contextKey]) {
          pattern = 'POC' + separator + query.predicate + separator + query.object + separator + query[contextKey] + separator;
        } else {
          pattern = 'POC' + separator + query.predicate + separator + query.object + separator;
        }
      } else if (query[contextKey]) {
        pattern = 'CP' + separator + query[contextKey] + separator + query.predicate + separator;
      } else {
        pattern = 'POC' + separator + query.predicate + separator;
      }
    } else if (query.object) {
      if (query[contextKey]) {
        pattern = 'OCS' + separator + query.object + separator + query[contextKey] + separator;
      } else {
        pattern = 'OCS' + separator + query.object + separator;
      }
    } else if (query[contextKey]) {
      pattern = 'CSP' + separator + query[contextKey] + separator;
    } else {
      pattern = 'SPOC' + separator;
    }
    return pattern;
  }

  _createEqualComparator(termNames) {
    if (!termNames) termNames = ['subject', 'predicate', 'object', 'graph'];
    return function equalComparator(quadA, quadB) {
      return termNames.reduce((eq, termName) => {
        return eq && quadA[termName] === quadB[termName];
      }, true);
    };
  }

  _createOrderComparator(termNames) {
    if (!termNames) termNames = ['subject', 'predicate', 'object', 'graph'];
    return function orderComparator(quadA, quadB) {
      function _compare(quadA, quadB, termNames) {
        if (termNames.length === 0) {
          return 0;
        }
        const termName = termNames[0];
        if (quadA[termName] === quadB[termName]) {
          return _compare(quadA, quadB, termNames.slice(1));
        }
        return quadA[termName] < quadB[termName] ? -1 : 1;
      }
      return _compare(quadA, quadB, termNames);
    };
  }

}

module.exports = QuadStore;
