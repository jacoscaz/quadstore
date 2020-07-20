'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
        return this.db.close();
    }
    toString() {
        return this.toJSON();
    }
    toJSON() {
        return `[object ${this.constructor.name}::${this.id}]`;
    }
    _addIndex(terms) {
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
    async put(quads, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(quads), 'The "quads" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await this._delput([], quads, opts);
    }
    async del(patternOrQuads, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(patternOrQuads), 'The "matchTermsOrOldQuads" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return (Array.isArray(patternOrQuads) || this._isQuad(patternOrQuads))
            ? await this._delput(patternOrQuads, [], opts)
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
        return { type: "quads", items: quads, sorting: results.sorting };
    }
    async search(stages, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isArray(stages), 'The "patterns" argument is not an array.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const results = await this.searchStream(stages, opts);
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
            ? await this._delput(patternOrOldQuads, newQuads, opts)
            : await this._getdelput(patternOrOldQuads, newQuads, opts);
    }
    async getApproximateSize(pattern, opts) {
        if (_.isNil(pattern))
            pattern = {};
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(pattern), 'The "matchTerms" argument is not a function..');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await get.getApproximateSize(this, pattern, opts);
    }
    async getStream(pattern, opts) {
        if (_.isNil(pattern))
            pattern = {};
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await get.getStream(this, pattern, opts);
    }
    async searchStream(stages, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isArray(stages), 'The "patterns" argument is not an array.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        return await search.searchStream(this, stages, opts);
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
        const iterator = asynciterator_1.default.AsyncIterator.wrap(source).transform(transformOpts);
        await utils.streamToArray(iterator);
    }
    _isQuad(obj) {
        return _.isString(obj.subject)
            && _.isString(obj.predicate)
            && _.isString(obj.object)
            && _.isString(obj.graph);
    }
    async _delput(oldQuads, newQuads, opts) {
        if (oldQuads !== null) {
            if (Array.isArray(oldQuads)) {
                await this.db.batch(_.flatMap(oldQuads, quad => this._quadToBatch(quad, 'del')));
            }
            else {
                await this.db.batch(this._quadToBatch(oldQuads, 'del'));
            }
        }
        if (newQuads !== null) {
            if (Array.isArray(newQuads)) {
                await this.db.batch(_.flatMap(newQuads, quad => this._quadToBatch(quad, 'put')));
            }
            else {
                await this.db.batch(this._quadToBatch(newQuads, 'put'));
            }
        }
    }
    async _getdelput(matchTerms, newQuads, opts) {
        const oldQuads = (await this.get(matchTerms, opts)).items;
        await this._delput(oldQuads, newQuads, {});
    }
    _quadToBatch(quad, type) {
        return this.indexes.map(i => ({
            type,
            key: i.getKey(quad),
            value: quad,
        }));
    }
    _getTermNames() {
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
}
exports.default = QuadStore;
//# sourceMappingURL=quadstore.js.map