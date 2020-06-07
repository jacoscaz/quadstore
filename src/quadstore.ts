
'use strict';

import {
  IQSIndex,
  IQSQuad,
  IQSQuadArrayResult,
  IQSRange,
  IQSStore,
  IQSTerms,
  TTermName,
  EResultType,
  IEmptyOpts,
  IReadable,
  IQSStoreOpts
} from './types';
import assert from 'assert';
import events from 'events';
import encode from 'encoding-down';
import levelup from 'levelup';
import ai from 'asynciterator';
import {AbstractLevelDOWN} from 'abstract-leveldown';

const _ = require('./utils/lodash');
const enums = require('./utils/enums');
const utils = require('./utils');
const get = require('./get');
const search = require('./search');

class QuadStore extends events.EventEmitter implements IQSStore {

  private readonly _db: AbstractLevelDOWN;
  private readonly _abstractLevelDOWN: AbstractLevelDOWN;

  protected readonly _defaultGraph: string;
  private readonly _indexes: IQSIndex[];
  private readonly _id: string;

  public readonly separator!: string;
  public readonly boundary!: string;

  /*
   * ==========================================================================
   *                           STORE LIFECYCLE
   * ==========================================================================
   */

  // @ts-ignore
  constructor(opts: IQSStoreOpts): IQSStore {
    super();
    assert(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(
      utils.isAbstractLevelDOWNInstance(opts.backend),
      'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN',
    );
    this._abstractLevelDOWN = opts.backend;
    this._db = levelup(encode(this._abstractLevelDOWN, {valueEncoding: 'json'}));
    this._defaultGraph = opts.defaultGraph || '_DEFAULT_CONTEXT_';
    this._indexes = [];
    this._id = utils.nanoid();
    utils.defineReadOnlyProperty(this, 'boundary', opts.boundary || '\uDBFF\uDFFF');
    utils.defineReadOnlyProperty(this, 'separator', opts.separator || '\u0000\u0000');
    (opts.indexes || utils.genDefaultIndexes())
      .forEach((index: TTermName[]) => this._addIndex(index));
    setImmediate(() => { this._initialize(); });
  }

  _initialize() {
    this.emit('ready');
  }

  close() {
    // @ts-ignore
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

  _addIndex(terms: TTermName[]): void {
    assert(utils.hasAllTerms(terms), 'Invalid index (bad terms).');
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

  async put(quads: IQSQuad|IQSQuad[], opts: IEmptyOpts): Promise<void> {
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(quads), 'The "quads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    // @ts-ignore
    return await this._delput([], quads, opts);
  }

  async del(matchTermsOrOldQuads: IQSTerms|IQSQuad|IQSQuad[], opts: IEmptyOpts): Promise<void> {
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTermsOrOldQuads), 'The "matchTermsOrOldQuads" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return (Array.isArray(matchTermsOrOldQuads) || this._isQuad(matchTermsOrOldQuads))
      // TODO: type checks not being understood by TS
      // @ts-ignore
      ? await this._delput(matchTermsOrOldQuads, [], opts)
      // TODO: type checks not being understood by TS
      // @ts-ignore
      : await this._getdelput(matchTermsOrOldQuads, [], opts);
  }

  async get(matchTerms: IQSTerms, opts: IEmptyOpts): Promise<IQSQuadArrayResult> {
    if (_.isNil(opts)) opts = {};
    if (_.isNil(matchTerms)) matchTerms = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.getStream(matchTerms, opts);
    const quads = await utils.streamToArray(results.iterator);
    return { type: EResultType.QUADS, items: quads, sorting: results.sorting };
  }

  async search(patterns: TQuadstoreSearchPattern[], filters: TQuadstoreSearchFilter[], opts: IEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(patterns), 'The "patterns" argument is not an array.');
    assert(_.isArray(filters), 'The "filters" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.searchStream(patterns, filters, opts);
    switch (results.type) {
      case enums.resultType.BINDINGS: {
        const bindings = await utils.streamToArray(results.bindings);
        return {type: results.type, bindings, sorting: results.sorting};
      } break;
      default:
        throw new Error(`Unsupported result type "${results.type}"`);
    }
  }

  async patch(matchTermsOrOldQuads: IQSTerms|IQSQuad|IQSQuad[], newQuads: IQSQuad|IQSQuad[], opts: IEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTermsOrOldQuads), 'Invalid type of "matchTermsOrOldQuads" argument.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return (Array.isArray(matchTermsOrOldQuads) || this._isQuad(matchTermsOrOldQuads))
      // TODO: fix type checks not being understood by TS
      // @ts-ignore
      ? await this._delput(matchTermsOrOldQuads, newQuads, opts)
      // TODO: fix type checks not being understood by TS
      // @ts-ignore
      : await this._getdelput(matchTermsOrOldQuads, newQuads, opts);
  }

  /*
   * ==========================================================================
   *                                COUNTING API
   * ==========================================================================
   */

  async getApproximateSize(matchTerms: IQSTerms, opts: IEmptyOpts) {
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

  async getStream(matchTerms: IQSTerms, opts: IEmptyOpts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await get.getStream(this, matchTerms, opts);
  }

  async searchStream(patterns: TQuadstoreSearchPattern[], filters: TQuadstoreSearchFilter[], opts: IEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isArray(patterns), 'The "patterns" argument is not an array.');
    assert(_.isArray(filters), 'The "filters" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    return await search.searchStream(this, patterns, filters, opts);
  }

  async putStream(source: IReadable<IQSQuad>, opts: IEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const transformOpts = {
      transform: (quad: IQSQuad, cb: () => void) => {
        this._delput([], [quad], opts)
          .then(cb.bind(null, null))
          .catch(cb);
      },
    };
    // TODO: address TS incompatible typings
    // @ts-ignore
    const iterator = ai.AsyncIterator.wrap(source).transform(transformOpts);
    await utils.streamToArray(iterator);
  }

  async delStream(source: IReadable<IQSQuad>, opts: IEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const transformOpts = {
      transform: (quad: IQSQuad, cb: () => void) => {
        this._delput([quad], [], opts)
          .then(cb.bind(null, null))
          .catch(cb);
      },
    };
    // TODO: address TS incompatible typings
    // @ts-ignore
    const iterator = ai.AsyncIterator.wrap(source).transform(transformOpts);
    await utils.streamToArray(iterator);
  }



  protected _isQuad(obj: any): boolean {
    return _.isString(obj.subject)
      && _.isString(obj.predicate)
      && _.isString(obj.object)
      && _.isString(obj.graph);
  }

  /*
   * ==========================================================================
   *                            LOW-LEVEL DB HELPERS
   * ==========================================================================
   */

  protected async _delput(oldQuads: IQSQuad|IQSQuad[], newQuads: IQSQuad|IQSQuad[], opts: IEmptyOpts) {
    if (oldQuads !== null) {
      if (Array.isArray(oldQuads)) {
        // @ts-ignore
        await this._db.batch(_.flatMap(oldQuads, quad => this._quadToBatch(quad, 'del')));
      } else {
        // @ts-ignore
        await this._db.batch(this._quadToBatch(oldQuads, 'del'));
      }
    }
    if (newQuads !== null) {
      if (Array.isArray(newQuads)) {
        // @ts-ignore
        await this._db.batch(_.flatMap(newQuads, quad => this._quadToBatch(quad, 'put')));
      } else {
        // @ts-ignore
        await this._db.batch(this._quadToBatch(newQuads, 'put'));
      }
    }
  }

  protected async _getdelput(matchTerms: IQSTerms, newQuads: IQSQuad|IQSQuad[], opts: IEmptyOpts) {
    const oldQuads = (await this.get(matchTerms, opts)).items;
    await this._delput(oldQuads, newQuads, {});
  }

  /**
   * Transforms a quad into a batch of either put or del
   * operations, one per each of the six indexes.
   * @param quad
   * @param type
   * @returns {}
   */
  protected _quadToBatch(quad: IQSQuad, type: 'del'|'put') {
    const indexes = this._indexes;
    // @ts-ignore
    if (!quad[contextKey]) {
      // @ts-ignore
      quad = {
        subject: quad.subject,
        predicate: quad.predicate,
        object: quad.object,
        graph: this._defaultGraph,
      };
    }
    return indexes.map(i => ({
        type,
        key: i.getKey(quad),
        value: quad,
    }));
  }

  protected _getTermNames(): TTermName[] {
    // @ts-ignore
    return ['subject', 'predicate', 'object', 'graph'];
  }

  protected _getTermValueComparator(): (a: string, b: string) => -1|0|1 {
    return (a: string, b: string) => {
      if (a < b) return -1;
      else if (a === b) return 0;
      else return 1;
    }
  }

  protected _getQuadComparator(termNames: TTermName[]) {
    if (!termNames) termNames = this._getTermNames();
    const valueComparator = this._getTermValueComparator();
    return (a: IQSQuad, b: IQSQuad) => {
      for (let i = 0, n = termNames.length, r: -1|0|1; i <= n; i += 1) {
        r = valueComparator(a[termNames[i]], b[termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

  protected _mergeTermRanges(a: IQSRange, b: IQSRange): IQSRange {
    const c = {...b};
    if (!_.isNil(a.lt)) {
      if (!_.isNil(c.lt)) {
        // @ts-ignore
        if (a.lt < c.lt) {
          c.lt = a.lt;
        }
      } else {
        c.lt = a.lt;
      }
    }
    if (!_.isNil(a.lte)) {
      if (!_.isNil(c.lte)) {
        // @ts-ignore
        if (a.lte < c.lte) {
          c.lte = a.lte;
        }
      } else {
        c.lte = a.lte;
      }
    }
    if (!_.isNil(a.gt)) {
      if (!_.isNil(c.gt)) {
        // @ts-ignore
        if (a.gt > c.gt) {
          c.gt = a.gt;
        }
      } else {
        c.gt = a.gt;
      }
    }
    if (!_.isNil(a.gte)) {
      if (!_.isNil(c.gte)) {
        // @ts-ignore
        if (a.gte > c.gte) {
          c.gte = a.gte;
        }
      } else {
        c.gte = a.gte;
      }
    }
    return c;
  }

  protected _mergeMatchTerms(a: IQSTerms, b: IQSTerms, termNames: TTermName[]): IQSTerms {
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
            // @ts-ignore
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

export default QuadStore;
