'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var assert_1 = require("assert");
var events_1 = require("events");
var encoding_down_1 = require("encoding-down");
var levelup_1 = require("levelup");
var asynciterator_1 = require("asynciterator");
var _ = require('./utils/lodash');
var enums = require('./utils/enums');
var utils = require('./utils');
var get = require('./get');
var search = require('./search');
var QuadStore = /** @class */ (function (_super) {
    __extends(QuadStore, _super);
    /*
     * ==========================================================================
     *                           STORE LIFECYCLE
     * ==========================================================================
     */
    function QuadStore(opts) {
        var _this = _super.call(this) || this;
        assert_1["default"](_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
        assert_1["default"](utils.isAbstractLevelDOWNInstance(opts.backend), 'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN');
        _this.abstractLevelDOWN = opts.backend;
        _this.db = levelup_1["default"](encoding_down_1["default"](_this.abstractLevelDOWN, { valueEncoding: 'json' }));
        _this.defaultGraph = opts.defaultGraph || '_DEFAULT_CONTEXT_';
        _this.indexes = [];
        _this.id = utils.nanoid();
        _this.boundary = opts.boundary || '\uDBFF\uDFFF';
        _this.separator = opts.separator || '\u0000\u0000';
        (opts.indexes || utils.genDefaultIndexes())
            .forEach(function (index) { return _this._addIndex(index); });
        setImmediate(function () { _this._initialize(); });
        return _this;
    }
    QuadStore.prototype._initialize = function () {
        this.emit('ready');
    };
    QuadStore.prototype.close = function () {
        // @ts-ignore
        return this.db.close();
    };
    /*
     * ==========================================================================
     *                           STORE SERIALIZATION
     * ==========================================================================
     */
    QuadStore.prototype.toString = function () {
        return this.toJSON();
    };
    QuadStore.prototype.toJSON = function () {
        return "[object " + this.constructor.name + "::" + this.id + "]";
    };
    /*
     * ==========================================================================
     *                                  INDEXES
     * ==========================================================================
     */
    QuadStore.prototype._addIndex = function (terms) {
        var _this = this;
        // assert(utils.hasAllTerms(terms), 'Invalid index (bad terms).');
        var name = terms.map(function (t) { return t.charAt(0).toUpperCase(); }).join('');
        this.indexes.push({
            terms: terms,
            name: name,
            getKey: eval('(quad) => `'
                + name + this.separator
                + terms.map(function (term) { return "${quad['" + term + "']}" + _this.separator; }).join('')
                + '`')
        });
    };
    /*
     * ==========================================================================
     *                            NON-STREAMING API
     * ==========================================================================
     */
    QuadStore.prototype.put = function (quads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isObject(quads), 'The "quads" argument is not an object.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, this._delput([], quads, opts)];
                    case 1: 
                    // @ts-ignore
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    QuadStore.prototype.del = function (patternOrQuads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isObject(patternOrQuads), 'The "matchTermsOrOldQuads" argument is not an object.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        if (!(Array.isArray(patternOrQuads) || this._isQuad(patternOrQuads))) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._delput(patternOrQuads, [], opts)
                            // TODO: type checks not being understood by TS
                            // @ts-ignore
                        ];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this._getdelput(patternOrQuads, [], opts)];
                    case 3:
                        _a = _b.sent();
                        _b.label = 4;
                    case 4: return [2 /*return*/, _a];
                }
            });
        });
    };
    QuadStore.prototype.get = function (pattern, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var results, quads;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        if (_.isNil(pattern))
                            pattern = {};
                        assert_1["default"](_.isObject(pattern), 'The "matchTerms" argument is not an object.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, this.getStream(pattern, opts)];
                    case 1:
                        results = _a.sent();
                        return [4 /*yield*/, utils.streamToArray(results.iterator)];
                    case 2:
                        quads = _a.sent();
                        return [2 /*return*/, { type: "quads" /* QUADS */, items: quads, sorting: results.sorting }];
                }
            });
        });
    };
    QuadStore.prototype.search = function (stages, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var results, _a, bindings;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isArray(stages), 'The "patterns" argument is not an array.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, this.searchStream(stages, opts)];
                    case 1:
                        results = _b.sent();
                        _a = results.type;
                        switch (_a) {
                            case enums.resultType.BINDINGS: return [3 /*break*/, 2];
                        }
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, utils.streamToArray(results.bindings)];
                    case 3:
                        bindings = _b.sent();
                        return [2 /*return*/, { type: results.type, items: bindings, sorting: results.sorting }];
                    case 4: throw new Error("Unsupported result type \"" + results.type + "\"");
                }
            });
        });
    };
    QuadStore.prototype.patch = function (patternOrOldQuads, newQuads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isObject(patternOrOldQuads), 'Invalid type of "matchTermsOrOldQuads" argument.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        if (!(Array.isArray(patternOrOldQuads) || this._isQuad(patternOrOldQuads))) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._delput(patternOrOldQuads, newQuads, opts)
                            // TODO: fix type checks not being understood by TS
                            // @ts-ignore
                        ];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this._getdelput(patternOrOldQuads, newQuads, opts)];
                    case 3:
                        _a = _b.sent();
                        _b.label = 4;
                    case 4: return [2 /*return*/, _a];
                }
            });
        });
    };
    /*
     * ==========================================================================
     *                                COUNTING API
     * ==========================================================================
     */
    QuadStore.prototype.getApproximateSize = function (pattern, opts) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(pattern))
                            pattern = {};
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isObject(pattern), 'The "matchTerms" argument is not a function..');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, get.getApproximateSize(this, pattern, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /*
     * ==========================================================================
     *                            STREAMING API
     * ==========================================================================
     */
    QuadStore.prototype.getStream = function (pattern, opts) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(pattern))
                            pattern = {};
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isObject(pattern), 'The "matchTerms" argument is not an object.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, get.getStream(this, pattern, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    QuadStore.prototype.searchStream = function (stages, opts) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isArray(stages), 'The "patterns" argument is not an array.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, search.searchStream(this, stages, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    QuadStore.prototype.putStream = function (source, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var transformOpts, iterator;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        transformOpts = {
                            transform: function (quad, cb) {
                                _this._delput([], [quad], opts)
                                    .then(cb.bind(null, null))["catch"](cb);
                            }
                        };
                        iterator = asynciterator_1["default"].AsyncIterator.wrap(source).transform(transformOpts);
                        return [4 /*yield*/, utils.streamToArray(iterator)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    QuadStore.prototype.delStream = function (source, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var transformOpts, iterator;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        transformOpts = {
                            transform: function (quad, cb) {
                                _this._delput([quad], [], opts)
                                    .then(cb.bind(null, null))["catch"](cb);
                            }
                        };
                        iterator = asynciterator_1["default"].AsyncIterator.wrap(source).transform(transformOpts);
                        return [4 /*yield*/, utils.streamToArray(iterator)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    QuadStore.prototype._isQuad = function (obj) {
        return _.isString(obj.subject)
            && _.isString(obj.predicate)
            && _.isString(obj.object)
            && _.isString(obj.graph);
    };
    /*
     * ==========================================================================
     *                            LOW-LEVEL DB HELPERS
     * ==========================================================================
     */
    QuadStore.prototype._delput = function (oldQuads, newQuads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(oldQuads !== null)) return [3 /*break*/, 4];
                        if (!Array.isArray(oldQuads)) return [3 /*break*/, 2];
                        // @ts-ignore
                        return [4 /*yield*/, this.db.batch(_.flatMap(oldQuads, function (quad) { return _this._quadToBatch(quad, 'del'); }))];
                    case 1:
                        // @ts-ignore
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: 
                    // @ts-ignore
                    return [4 /*yield*/, this.db.batch(this._quadToBatch(oldQuads, 'del'))];
                    case 3:
                        // @ts-ignore
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        if (!(newQuads !== null)) return [3 /*break*/, 8];
                        if (!Array.isArray(newQuads)) return [3 /*break*/, 6];
                        // @ts-ignore
                        return [4 /*yield*/, this.db.batch(_.flatMap(newQuads, function (quad) { return _this._quadToBatch(quad, 'put'); }))];
                    case 5:
                        // @ts-ignore
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 6: 
                    // @ts-ignore
                    return [4 /*yield*/, this.db.batch(this._quadToBatch(newQuads, 'put'))];
                    case 7:
                        // @ts-ignore
                        _a.sent();
                        _a.label = 8;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    QuadStore.prototype._getdelput = function (matchTerms, newQuads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var oldQuads;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.get(matchTerms, opts)];
                    case 1:
                        oldQuads = (_a.sent()).items;
                        return [4 /*yield*/, this._delput(oldQuads, newQuads, {})];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Transforms a quad into a batch of either put or del
     * operations, one per each of the six indexes.
     * @param quad
     * @param type
     * @returns {}
     */
    QuadStore.prototype._quadToBatch = function (quad, type) {
        return this.indexes.map(function (i) { return ({
            type: type,
            key: i.getKey(quad),
            value: quad
        }); });
    };
    QuadStore.prototype._getTermNames = function () {
        // @ts-ignore
        return ['subject', 'predicate', 'object', 'graph'];
    };
    QuadStore.prototype._getTermValueComparator = function () {
        return function (a, b) {
            if (a < b)
                return -1;
            else if (a === b)
                return 0;
            else
                return 1;
        };
    };
    QuadStore.prototype._getQuadComparator = function (termNames) {
        if (!termNames)
            termNames = this._getTermNames();
        var valueComparator = this._getTermValueComparator();
        return function (a, b) {
            for (var i = 0, n = termNames.length, r = void 0; i <= n; i += 1) {
                r = valueComparator(a[termNames[i]], b[termNames[i]]);
                if (r !== 0)
                    return r;
            }
            return 0;
        };
    };
    QuadStore.prototype._mergeTermRanges = function (a, b) {
        var c = __assign({}, b);
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
    };
    return QuadStore;
}(events_1["default"].EventEmitter));
exports["default"] = QuadStore;
