
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

  close() {
    return this._db.close();
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

  async put(quads, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(quads), 'The "quads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await this._delput(null, quads, opts);
  }

  async del(matchTermsOrOldQuads, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTermsOrOldQuads), 'The "matchTermsOrOldQuads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return (Array.isArray(matchTermsOrOldQuads) || this._isQuad(matchTermsOrOldQuads))
      ? await this._delput(matchTermsOrOldQuads, null, opts)
      : await this._getdelput(matchTermsOrOldQuads, null, opts);
  }

  /**
   * Returns all quads matching the provided terms.
   * @param matchTerms
   * @param cb
   */
  async get(matchTerms, opts) {
    if (_.isNil(opts)) opts = {};
    if (_.isNil(matchTerms)) matchTerms = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.getStream(matchTerms, opts);
    const quads = await utils.streamToArray(results.iterator);
    return { quads, sorting: results.sorting };
  }

  async search(patterns, filters, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(patterns), 'The "patterns" argument is not an array.');
    assert(_.isArray(filters), 'The "filters" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await this.searchStream(patterns, filters, opts)
      .then(utils.streamToArray);
  }

  async patch(matchTermsOrOldQuads, newQuads, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTermsOrOldQuads), 'Invalid type of "matchTermsOrOldQuads" argument.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return (Array.isArray(matchTermsOrOldQuads) || this._isQuad(matchTermsOrOldQuads))
      ? await this._delput(matchTermsOrOldQuads, newQuads, opts)
      : await this._getdelput(matchTermsOrOldQuads, newQuads, opts);
  }

  /*
   * ==========================================================================
   *                                COUNTING API
   * ==========================================================================
   */

  async getApproximateSize(matchTerms, opts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not a function..');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await get.getApproximateSize(this, matchTerms, opts);
  }

  /*
   * ==========================================================================
   *                            STREAMING API
   * ==========================================================================
   */

  async getStream(matchTerms, opts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await get.getStream(this, matchTerms, opts);
  }

  async searchStream(patterns, filters, opts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(patterns), 'The "patterns" argument is not an array.');
    assert(_.isArray(filters), 'The "filters" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await search.searchStream(this, patterns, filters, opts);
  }

  async putStream(source, opts, cb) {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const iterator = AsyncIterator.wrap(source).transform((quad, cb) => {
      this._delput(null, [quad], opts)
        .then(cb.bind(null, null))
        .catch(cb);
    });
    await utils.streamToArray(iterator);
  }

  async delStream(source, opts) {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const iterator = AsyncIterator.wrap(source).transform((quad, cb) => {
      this._delput([quad], null, opts)
        .then(cb.bind(null, null))
        .catch(cb);
    });
    await utils.streamToArray(iterator);
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

  async _delput(oldQuads, newQuads, opts) {
    if (oldQuads !== null) {
      if (Array.isArray(oldQuads)) {
        await this._db.batch(_.flatMap(oldQuads, quad => this._quadToBatch(quad, 'del')));
      } else {
        await this._db.batch(this._quadToBatch(oldQuads, 'del'));
      }
    }
    if (newQuads !== null) {
      if (Array.isArray(newQuads)) {
        await this._db.batch(_.flatMap(newQuads, quad => this._quadToBatch(quad, 'put')));
      } else {
        await this._db.batch(this._quadToBatch(newQuads, 'put'));
      }
    }
  }

  async _getdelput(matchTerms, newQuads, opts) {
    const oldQuads = (await this.get(matchTerms, opts)).quads;
    await this._delput(oldQuads, newQuads);
  }

  /**
   * Transforms a quad into a batch of either put or del
   * operations, one per each of the six indexes.
   * @param quad
   * @param type
   * @returns {}
   */
  _quadToBatch(quad, type) {
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
    return indexes.map(i => ({
        type,
        key: i.getKey(quad),
        value: quad,
    }));
  }

  _getTermNames() {
    return ['subject', 'predicate', 'object', this._contextKey];
  }

  _getTermValueComparator() {
    return (a, b) => {
      if (a < b) return -1;
      else if (a === b) return 0;
      else return 1;
    }
  }

  _getQuadComparator(termNames) {
    if (!termNames) termNames = this._getTermNames();
    const valueComparator = this._getTermValueComparator();
    return (a, b) => {
      for (let i = 0, n = termNames.length, r; i <= n; i += 1) {
        r = valueComparator(a[termNames[i]], b[termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

  _mergeTermRanges(a, b) {
    const c = {...b};
    if (!_.isNil(a.lt)) {
      if (!_.isNil(c.lt)) {
        if (a.lt < c.lt) {
          c.lt = a.lt;
        }
      } else {
        c.lt = a.lt;
      }
    }
    if (!_.isNil(a.lte)) {
      if (!_.isNil(c.lte)) {
        if (a.lte < c.lte) {
          c.lte = a.lte;
        }
      } else {
        c.lte = a.lte;
      }
    }
    if (!_.isNil(a.gt)) {
      if (!_.isNil(c.gt)) {
        if (a.gt > c.gt) {
          c.gt = a.gt;
        }
      } else {
        c.gt = a.gt;
      }
    }
    if (!_.isNil(a.gte)) {
      if (!_.isNil(c.gte)) {
        if (a.gte > c.gte) {
          c.gte = a.gte;
        }
      } else {
        c.gte = a.gte;
      }
    }
  }

  _mergeMatchTerms(a, b, termNames) {
    if (!termNames) {
      termNames = this._getTermNames();
    }
    const c = { ...b };
    termNames.forEach((termName) => {
      if (_.isNil(c[termName])) {
        if (!_.isNil(a[termName])) {
          c[termName] = a[termName];
        }
      } else {
        if (!_.isNil(a[termName])) {
          if (_.isObject(a[termName]) && _.isObject(c[termName])) {
            c[termName] = this._mergeTermRanges(a[termName], c[termName]);
          } else {
            throw new Error(`Cannot merge match terms`);
          }
        }
      }
    });
    return c;
  };

}

module.exports = QuadStore;
