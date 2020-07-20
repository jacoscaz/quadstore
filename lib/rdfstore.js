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
var _ = require("./utils/lodash");
var utils = require("./utils");
var assert_1 = require("assert");
var events_1 = require("events");
var quadstore_1 = require("./quadstore");
var serialization = require("./rdf/serialization");
var sparql = require("./sparql");
var asynciterator_1 = require("asynciterator");
var RdfStore = /** @class */ (function (_super) {
    __extends(RdfStore, _super);
    function RdfStore(opts) {
        var _this = _super.call(this) || this;
        assert_1["default"](_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
        assert_1["default"](utils.isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
        var dataFactory = opts.dataFactory;
        _this.dataFactory = dataFactory;
        var quadstoreOpts = __assign(__assign({}, opts), { defaultGraph: serialization.importSimpleTerm(dataFactory.defaultGraph(), true, 'urn:rdfstore:dg') });
        _this.quadstore = new quadstore_1["default"](quadstoreOpts);
        _this.quadstore.on('ready', function () {
            _this.emit('ready');
        });
        return _this;
    }
    // **************************************************************************
    // ******************************** RDF/JS **********************************
    // **************************************************************************
    RdfStore.prototype.match = function (subject, predicate, object, graph) {
        var iterator = new asynciterator_1["default"].TransformIterator();
        var pattern = { subject: subject, predicate: predicate, object: object, graph: graph };
        this.getStream(pattern, {})
            .then(function (results) {
            iterator.source = results.iterator;
        })["catch"](function (err) {
            // TODO: is the destroy() method really supported by AsyncIterator?
            // @ts-ignore
            iterator.destroy();
        });
        return iterator;
    };
    /**
     * RDF/JS.Sink.import()
     * @param source
     * @param opts
     * @returns {*|EventEmitter}
     */
    RdfStore.prototype["import"] = function (source) {
        assert_1["default"](utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
        var emitter = new events_1.EventEmitter();
        this.putStream(source, {})
            .then(function () { emitter.emit('end'); })["catch"](function (err) { emitter.emit('error', err); });
        return emitter;
    };
    RdfStore.prototype.remove = function (source) {
        assert_1["default"](utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
        var emitter = new events_1.EventEmitter();
        this.delStream(source, {})
            .then(function () { return emitter.emit('end'); })["catch"](function (err) { return emitter.emit('error', err); });
        return emitter;
    };
    /**
     * RDF/JS.Store.removeMatches()
     * @param subject
     * @param predicate
     * @param object
     * @param graph
     * @returns {*}
     */
    RdfStore.prototype.removeMatches = function (subject, predicate, object, graph) {
        var source = this.match(subject, predicate, object, graph);
        return this.remove(source);
    };
    /**
     * RDF/JS.Store.deleteGraph()
     * @param graph
     * @returns {*}
     */
    RdfStore.prototype.deleteGraph = function (graph) {
        return this.removeMatches(undefined, undefined, undefined, graph);
    };
    // **************************************************************************
    // ******************************* ARRAY API ********************************
    // **************************************************************************
    RdfStore.prototype.getApproximateSize = function (pattern, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedTerms;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        importedTerms = serialization.importPattern(pattern, this.quadstore.defaultGraph);
                        return [4 /*yield*/, this.quadstore.getApproximateSize(importedTerms, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype.sparql = function (query, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var results, _a, bindings, quads;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isString(query), 'The "query" argument is not an array.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        return [4 /*yield*/, this.sparqlStream(query, opts)];
                    case 1:
                        results = _b.sent();
                        _a = results.type;
                        switch (_a) {
                            case "bindings" /* BINDINGS */: return [3 /*break*/, 2];
                            case "void" /* VOID */: return [3 /*break*/, 4];
                            case "quads" /* QUADS */: return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 7];
                    case 2: return [4 /*yield*/, utils.streamToArray(results.iterator)];
                    case 3:
                        bindings = _b.sent();
                        return [2 /*return*/, __assign(__assign({}, results), { items: bindings })];
                    case 4:
                        {
                            return [2 /*return*/, results];
                        }
                        return [3 /*break*/, 8];
                    case 5: return [4 /*yield*/, utils.streamToArray(results.iterator)];
                    case 6:
                        quads = _b.sent();
                        return [2 /*return*/, __assign(__assign({}, results), { items: quads })];
                    case 7: 
                    // @ts-ignore
                    throw new Error("Unsupported results type \"" + results.type + "\"");
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    RdfStore.prototype.put = function (quads, opts) {
        if (opts === void 0) { opts = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var importedQuads;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        importedQuads = Array.isArray(quads)
                            ? quads.map(function (quad) { return serialization.importQuad(quad, _this.quadstore.defaultGraph); })
                            : serialization.importQuad(quads, this.quadstore.defaultGraph);
                        return [4 /*yield*/, this.quadstore.put(importedQuads, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype.del = function (patternOrOldQuads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedPatternOrOldQuads;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (Array.isArray(patternOrOldQuads)) {
                            importedPatternOrOldQuads = patternOrOldQuads.map(function (quad) { return serialization.importQuad(quad, _this.quadstore.defaultGraph); });
                        }
                        else if (utils.hasAllTerms(patternOrOldQuads)) {
                            importedPatternOrOldQuads = serialization.importQuad(patternOrOldQuads, this.quadstore.defaultGraph);
                        }
                        else {
                            importedPatternOrOldQuads = serialization.importPattern(patternOrOldQuads, this.quadstore.defaultGraph);
                        }
                        return [4 /*yield*/, this.quadstore.del(importedPatternOrOldQuads, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype.get = function (pattern, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var results, items;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getStream(pattern, opts)];
                    case 1:
                        results = _a.sent();
                        return [4 /*yield*/, utils.streamToArray(results.iterator)];
                    case 2:
                        items = _a.sent();
                        return [2 /*return*/, { type: results.type, items: items, sorting: results.sorting }];
                }
            });
        });
    };
    RdfStore.prototype.patch = function (matchTermsOrOldQuads, newQuads, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedPatternOrOldQuads, importedNewQuads;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (Array.isArray(matchTermsOrOldQuads)) {
                            importedPatternOrOldQuads = matchTermsOrOldQuads.map(function (quad) { return serialization.importQuad(quad, _this.quadstore.defaultGraph); });
                        }
                        else if (utils.hasAllTerms(matchTermsOrOldQuads)) {
                            importedPatternOrOldQuads = serialization.importQuad(matchTermsOrOldQuads, this.quadstore.defaultGraph);
                        }
                        else {
                            importedPatternOrOldQuads = serialization.importPattern(matchTermsOrOldQuads, this.quadstore.defaultGraph);
                        }
                        importedNewQuads = Array.isArray(newQuads)
                            ? newQuads.map(function (quad) { return serialization.importQuad(quad, _this.quadstore.defaultGraph); })
                            : serialization.importQuad(newQuads, this.quadstore.defaultGraph);
                        return [4 /*yield*/, this.quadstore.patch(importedPatternOrOldQuads, importedNewQuads, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype.search = function (stages, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedStages, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        importedStages = stages.map(function (stage) { return serialization.importSearchStage(stage, _this.quadstore.defaultGraph); });
                        return [4 /*yield*/, this.quadstore.search(importedStages, opts)];
                    case 1:
                        result = _a.sent();
                        switch (result.type) {
                            case "quads" /* QUADS */:
                                return [2 /*return*/, __assign(__assign({}, result), { items: result.items.map(function (quad) { return serialization.exportQuad(quad, _this.quadstore.defaultGraph, _this.dataFactory); }) })];
                            case "bindings" /* BINDINGS */:
                                return [2 /*return*/, __assign(__assign({}, result), { items: result.items.map(function (binding) { return serialization.exportBinding(binding, _this.quadstore.defaultGraph, _this.dataFactory); }) })];
                            default:
                                // @ts-ignore
                                throw new Error("Unsupported result type \"" + result.type + "\"");
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // **************************************************************************
    // ******************************* STREAM API *******************************
    // **************************************************************************
    RdfStore.prototype.getStream = function (pattern, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedMatchTerms, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(pattern))
                            pattern = {};
                        if (_.isNil(opts))
                            opts = {};
                        assert_1["default"](_.isObject(pattern), 'The "matchTerms" argument is not an object.');
                        assert_1["default"](_.isObject(opts), 'The "opts" argument is not an object.');
                        importedMatchTerms = serialization.importPattern(pattern, this.quadstore.defaultGraph);
                        return [4 /*yield*/, this.quadstore.getStream(importedMatchTerms, opts)];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, {
                                type: "quads" /* QUADS */,
                                iterator: results.iterator.map(this._createQuadDeserializerMapper()),
                                sorting: results.sorting
                            }];
                }
            });
        });
    };
    RdfStore.prototype.putStream = function (source, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedQuadsIterator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        importedQuadsIterator = asynciterator_1["default"].AsyncIterator.wrap(source)
                            .map(this._createQuadSerializerMapper());
                        return [4 /*yield*/, this.quadstore.putStream(importedQuadsIterator, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype.delStream = function (source, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedQuadsIterator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        importedQuadsIterator = asynciterator_1["default"].AsyncIterator.wrap(source)
                            .map(this._createQuadSerializerMapper());
                        return [4 /*yield*/, this.quadstore.delStream(importedQuadsIterator, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype.searchStream = function (stages, opts) {
        return __awaiter(this, void 0, void 0, function () {
            var importedStages, results, iterator;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        importedStages = stages.map(function (stage) { return serialization.importSearchStage(stage, _this.quadstore.defaultGraph); });
                        return [4 /*yield*/, this.quadstore.searchStream(importedStages, opts)];
                    case 1:
                        results = _a.sent();
                        switch (results.type) {
                            case "bindings" /* BINDINGS */:
                                iterator = results.iterator.map(function (binding) {
                                    return serialization.exportBinding(binding, _this.quadstore.defaultGraph, _this.dataFactory);
                                });
                                break;
                            case "quads" /* QUADS */:
                                iterator = results.iterator.map(function (quad) {
                                    return serialization.exportQuad(quad, _this.quadstore.defaultGraph, _this.dataFactory);
                                });
                                break;
                            default:
                                throw new Error("Unsupported result type \"" + results.type + "\"");
                        }
                        return [2 /*return*/, __assign(__assign({}, results), { iterator: iterator })];
                }
            });
        });
    };
    RdfStore.prototype.sparqlStream = function (query, opts) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (_.isNil(opts))
                            opts = {};
                        return [4 /*yield*/, sparql.sparqlStream(this, query, opts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    RdfStore.prototype._createQuadSerializerMapper = function () {
        var _this = this;
        return function (quad) {
            return serialization.importQuad(quad, _this.quadstore.defaultGraph);
        };
    };
    RdfStore.prototype._createQuadDeserializerMapper = function () {
        var _this = this;
        return function (quad) {
            return serialization.exportQuad(quad, _this.quadstore.defaultGraph, _this.dataFactory);
        };
    };
    return RdfStore;
}(events_1.EventEmitter));
exports["default"] = RdfStore;
