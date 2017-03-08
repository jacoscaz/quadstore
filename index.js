
'use strict';

const _ = require('lodash');
const stream = require('stream');
const events = require('events');
const levelup = require('levelup');

/**
 * De(serialization) for LevelDB
 */
const valueEncoding = { encode: JSON.stringify, decode: JSON.parse };

/**
 * Transforms a quad into a batch of either put or del
 * operations, one per each of the six indexes.
 * @param quad
 * @param opts
 * @returns {}
 */
function quadToBatch(quad, opts) {
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
function createQuadToBatchIteratee(opts) {
  return function quadToBatchIteratee(quad) {
    return quadToBatch(quad, opts);
  };
}

/**
 * Transforms a query into a matching pattern targeting
 * the appropriate index.
 * @param query
 * @returns {*}
 */
function queryToPattern(query, opts) {
  const separator = opts.separator;
  const contextKey = opts.contextKey;
  let pattern;
  if (query.subject) {
    if (query.predicate) {
      if (query.object) {
        if (query[contextKey]) {
          pattern = 'SPOC' + separator + query.subject + separator + query.predicate + separator + query.object + separator + query[contextKey] + separator;
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

/**
 *
 */
class QuadStore extends events.EventEmitter {

  constructor(opts) {
    super();
    this._db = levelup(opts.db, { valueEncoding });
    this._separator = opts.separator || '::';
    this._contextKey = opts.contextKey || 'context';
  }

  //
  // BASIC ACCESS
  //

  put(quads, cb) {
    if (!Array.isArray(quads)) quads = [quads];
    const batch = _.flatMap(quads, createQuadToBatchIteratee({
      type: 'put',
      separator: this._separator,
      contextKey: this._contextKey,
    }));
    this._db.batch(batch, cb);
  }

  del(quads, cb) {
    if (!Array.isArray(quads)) quads = [quads];
    const batch = _.flatMap(quads, createQuadToBatchIteratee({
      type: 'del',
      separator: this._separator,
      contextKey: this._contextKey,
    }));
    this._db.batch(batch, cb);
  }

  delput(oldQuads, newQuads, cb) {
    if (!Array.isArray(oldQuads)) oldQuads = [oldQuads];
    if (!Array.isArray(newQuads)) newQuads = [newQuads];
    const batch = [].concat(
      _.flatMap(oldQuads, createQuadToBatchIteratee({
        type: 'del',
        separator: this._separator,
        contextKey: this._contextKey,
      })),
      _.flatMap(newQuads, createQuadToBatchIteratee({
        type: 'put',
        separator: this._separator,
        contextKey: this._contextKey,
      }))
    );
    this._db.batch(batch, cb);
  }

  //
  // MATCHING
  //

  /**
   * Returns all quads matching the provided terms.
   * @param matchTerms
   * @param cb
   */
  match(matchTerms, cb) {
    const quads = [];
    this.createReadStream(matchTerms)
      .on('data', (quad) => {
        quads.push(quad);
      })
      .on('end', () => {
        cb(null, quads);
      })
      .on('error', (err) => {
        cb(err);
      });
  }

  matchDeleteAndInsert(matchTerms, newQuads, cb) {
    const store = this;
    if (_.isFunction(newQuads)) {
      cb = newQuads;
      newQuads = [];
    }
    this.match(matchTerms, (matchErr, oldQuads) => {
      if (matchErr) { cb(matchErr); return; }
      store.delput(oldQuads, newQuads, cb);
    });
  }

  //
  // SEARCHING
  // todo
  // https://en.wikipedia.org/wiki/Sort-merge_join
  //

  //
  // STREAMS
  //

  createReadStream(query) {
    const pattern = queryToPattern(query, {
      separator: this._separator,
      contextKey: this._contextKey,
    });
    return this._db.createValueStream({
      start: pattern,
      end: pattern + '\xff',
    });
  }

  createWriteStream() {
    const store = this;
    return new stream.Writable({
      objectMode: true,
      write: (quads, enc, cb) => {
        store.put(quads, cb);
      },
    });
  }

  //
  // UTILS
  //

  getApproximateSize(query, cb) {
    const pattern = queryToPattern(query, {
      separator: this._separator,
      contextKey: this._contextKey,
    });
    this._db.db.approximateSize(pattern, pattern + '\xff', cb);
  }

}

module.exports = QuadStore;
