'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const assert_1 = __importDefault(require("assert"));
const events_1 = __importDefault(require("events"));
const encoding_down_1 = __importDefault(require("encoding-down"));
const levelup_1 = __importDefault(require("levelup"));
const asynciterator_1 = __importDefault(require("asynciterator"));
const _ = require('./utils/lodash');
const enums = require('./utils/enums');
const utils = require('./utils');
const get = require('./get');
const search = require('./search');
class QuadStore extends events_1.default.EventEmitter {
    /*
     * ==========================================================================
     *                           STORE LIFECYCLE
     * ==========================================================================
     */
    // @ts-ignore
    constructor(opts) {
        super();
        assert_1.default(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
        assert_1.default(utils.isAbstractLevelDOWNInstance(opts.backend), 'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN');
        this.abstractLevelDOWN = opts.backend;
        this.db = levelup_1.default(encoding_down_1.default(this.abstractLevelDOWN, { valueEncoding: 'json' }));
        this.defaultGraph = opts.defaultGraph || '_DEFAULT_CONTEXT_';
        this.indexes = [];
        this.id = utils.nanoid();
        this.boundary = opts.boundary || '\uDBFF\uDFFF';
        this.separator = opts.separator || '\u0000\u0000';
        (opts.indexes || utils.genDefaultIndexes())
            .forEach((index) => this._addIndex(index));
        setImmediate(() => { this._initialize(); });
    }
    _initialize() {
        this.emit('ready');
    }
    close() {
        // @ts-ignore
        return this.db.close();
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
        return `[object ${this.constructor.name}::${this.id}]`;
    }
    /*
     * ==========================================================================
     *                                  INDEXES
     * ==========================================================================
     */
    _addIndex(terms) {
        assert_1.default(utils.hasAllTerms(terms), 'Invalid index (bad terms).');
        const name = terms.map(t => t.charAt(0).toUpperCase()).join('');
        this.indexes.push({
            terms,
            name,
            getKey: eval('(quad) => `'
                + name + this.separator
                + terms.map(term => `\${quad['${term}']}${this.separator}`).join('')
                + '`'),
        });
    }
    /*
     * ==========================================================================
     *                            NON-STREAMING API
     * ==========================================================================
     */
    async put(quads, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(quads), 'The "quads" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        // @ts-ignore
        return await this._delput([], quads, opts);
    }
    async del(patternOrQuads, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(patternOrQuads), 'The "matchTermsOrOldQuads" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return (Array.isArray(patternOrQuads) || this._isQuad(patternOrQuads))
            // TODO: type checks not being understood by TS
            // @ts-ignore
            ? await this._delput(patternOrQuads, [], opts)
            // TODO: type checks not being understood by TS
            // @ts-ignore
            : await this._getdelput(patternOrQuads, [], opts);
    }
    async get(pattern, opts) {
        if (_.isNil(opts))
            opts = {};
        if (_.isNil(pattern))
            pattern = {};
        assert_1.default(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const results = await this.getStream(pattern, opts);
        const quads = await utils.streamToArray(results.iterator);
        return { type: types_1.TSResultType.QUADS, items: quads, sorting: results.sorting };
    }
    async search(pipeline, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isArray(pipeline), 'The "patterns" argument is not an array.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const results = await this.searchStream(pipeline, opts);
        switch (results.type) {
            case enums.resultType.BINDINGS:
                {
                    const bindings = await utils.streamToArray(results.bindings);
                    return { type: results.type, items: bindings, sorting: results.sorting };
                }
                break;
            default:
                throw new Error(`Unsupported result type "${results.type}"`);
        }
    }
    async patch(patternOrOldQuads, newQuads, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(patternOrOldQuads), 'Invalid type of "matchTermsOrOldQuads" argument.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return (Array.isArray(patternOrOldQuads) || this._isQuad(patternOrOldQuads))
            // TODO: fix type checks not being understood by TS
            // @ts-ignore
            ? await this._delput(patternOrOldQuads, newQuads, opts)
            // TODO: fix type checks not being understood by TS
            // @ts-ignore
            : await this._getdelput(patternOrOldQuads, newQuads, opts);
    }
    /*
     * ==========================================================================
     *                                COUNTING API
     * ==========================================================================
     */
    async getApproximateSize(pattern, opts) {
        if (_.isNil(pattern))
            pattern = {};
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(pattern), 'The "matchTerms" argument is not a function..');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await get.getApproximateSize(this, pattern, opts);
    }
    /*
     * ==========================================================================
     *                            STREAMING API
     * ==========================================================================
     */
    async getStream(pattern, opts) {
        if (_.isNil(pattern))
            pattern = {};
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await get.getStream(this, pattern, opts);
    }
    async searchStream(pipeline, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isArray(pipeline), 'The "patterns" argument is not an array.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await search.searchStream(this, pipeline, opts);
    }
    async putStream(source, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const transformOpts = {
            transform: (quad, cb) => {
                this._delput([], [quad], opts)
                    .then(cb.bind(null, null))
                    .catch(cb);
            },
        };
        // TODO: address TS incompatible typings
        // @ts-ignore
        const iterator = asynciterator_1.default.AsyncIterator.wrap(source).transform(transformOpts);
        await utils.streamToArray(iterator);
    }
    async delStream(source, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const transformOpts = {
            transform: (quad, cb) => {
                this._delput([quad], [], opts)
                    .then(cb.bind(null, null))
                    .catch(cb);
            },
        };
        // TODO: address TS incompatible typings
        // @ts-ignore
        const iterator = asynciterator_1.default.AsyncIterator.wrap(source).transform(transformOpts);
        await utils.streamToArray(iterator);
    }
    _isQuad(obj) {
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
    async _delput(oldQuads, newQuads, opts) {
        if (oldQuads !== null) {
            if (Array.isArray(oldQuads)) {
                // @ts-ignore
                await this.db.batch(_.flatMap(oldQuads, quad => this._quadToBatch(quad, 'del')));
            }
            else {
                // @ts-ignore
                await this.db.batch(this._quadToBatch(oldQuads, 'del'));
            }
        }
        if (newQuads !== null) {
            if (Array.isArray(newQuads)) {
                // @ts-ignore
                await this.db.batch(_.flatMap(newQuads, quad => this._quadToBatch(quad, 'put')));
            }
            else {
                // @ts-ignore
                await this.db.batch(this._quadToBatch(newQuads, 'put'));
            }
        }
    }
    async _getdelput(matchTerms, newQuads, opts) {
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
    _quadToBatch(quad, type) {
        const indexes = this.indexes;
        // @ts-ignore
        if (!quad[contextKey]) {
            // @ts-ignore
            quad = {
                subject: quad.subject,
                predicate: quad.predicate,
                object: quad.object,
                graph: this.defaultGraph,
            };
        }
        return indexes.map(i => ({
            type,
            key: i.getKey(quad),
            value: quad,
        }));
    }
    _getTermNames() {
        // @ts-ignore
        return ['subject', 'predicate', 'object', 'graph'];
    }
    _getTermValueComparator() {
        return (a, b) => {
            if (a < b)
                return -1;
            else if (a === b)
                return 0;
            else
                return 1;
        };
    }
    _getQuadComparator(termNames) {
        if (!termNames)
            termNames = this._getTermNames();
        const valueComparator = this._getTermValueComparator();
        return (a, b) => {
            for (let i = 0, n = termNames.length, r; i <= n; i += 1) {
                r = valueComparator(a[termNames[i]], b[termNames[i]]);
                if (r !== 0)
                    return r;
            }
            return 0;
        };
    }
    _mergeTermRanges(a, b) {
        const c = { ...b };
        if (!_.isNil(a.lt)) {
            if (!_.isNil(c.lt)) {
                // @ts-ignore
                if (a.lt < c.lt) {
                    c.lt = a.lt;
                }
            }
            else {
                c.lt = a.lt;
            }
        }
        if (!_.isNil(a.lte)) {
            if (!_.isNil(c.lte)) {
                // @ts-ignore
                if (a.lte < c.lte) {
                    c.lte = a.lte;
                }
            }
            else {
                c.lte = a.lte;
            }
        }
        if (!_.isNil(a.gt)) {
            if (!_.isNil(c.gt)) {
                // @ts-ignore
                if (a.gt > c.gt) {
                    c.gt = a.gt;
                }
            }
            else {
                c.gt = a.gt;
            }
        }
        if (!_.isNil(a.gte)) {
            if (!_.isNil(c.gte)) {
                // @ts-ignore
                if (a.gte > c.gte) {
                    c.gte = a.gte;
                }
            }
            else {
                c.gte = a.gte;
            }
        }
        return c;
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
            }
            else {
                if (!_.isNil(a[termName])) {
                    if (_.isObject(a[termName]) && _.isObject(c[termName])) {
                        // @ts-ignore
                        c[termName] = this._mergeTermRanges(a[termName], c[termName]);
                    }
                    else {
                        throw new Error(`Cannot merge match terms`);
                    }
                }
            }
        });
        return c;
    }
    ;
}
exports.default = QuadStore;
