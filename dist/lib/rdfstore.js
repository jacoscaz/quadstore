'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("./utils/lodash"));
const utils = __importStar(require("./utils"));
const assert_1 = __importDefault(require("assert"));
const events_1 = require("events");
const quadstore_1 = __importDefault(require("./quadstore"));
const serialization = __importStar(require("./rdf/serialization"));
const sparql = __importStar(require("./sparql"));
const asynciterator_1 = __importDefault(require("asynciterator"));
class RdfStore extends events_1.EventEmitter {
    constructor(opts) {
        super();
        assert_1.default(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
        assert_1.default(utils.isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
        const { dataFactory } = opts;
        this.dataFactory = dataFactory;
        const quadstoreOpts = {
            ...opts,
            defaultGraph: serialization.importSimpleTerm(dataFactory.defaultGraph(), true, 'urn:rdfstore:dg'),
        };
        this.quadstore = new quadstore_1.default(quadstoreOpts);
        this.quadstore.on('ready', () => {
            this.emit('ready');
        });
    }
    match(subject, predicate, object, graph) {
        const iterator = new asynciterator_1.default.TransformIterator();
        const pattern = { subject, predicate, object, graph };
        this.getStream(pattern, {})
            .then((results) => {
            iterator.source = results.iterator;
        })
            .catch((err) => {
            iterator.destroy();
        });
        return iterator;
    }
    import(source) {
        assert_1.default(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
        const emitter = new events_1.EventEmitter();
        this.putStream(source, {})
            .then(() => { emitter.emit('end'); })
            .catch((err) => { emitter.emit('error', err); });
        return emitter;
    }
    remove(source) {
        assert_1.default(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
        const emitter = new events_1.EventEmitter();
        this.delStream(source, {})
            .then(() => emitter.emit('end'))
            .catch((err) => emitter.emit('error', err));
        return emitter;
    }
    removeMatches(subject, predicate, object, graph) {
        const source = this.match(subject, predicate, object, graph);
        return this.remove(source);
    }
    deleteGraph(graph) {
        return this.removeMatches(undefined, undefined, undefined, graph);
    }
    async getApproximateSize(pattern, opts) {
        const importedTerms = serialization.importPattern(pattern, this.quadstore.defaultGraph);
        return await this.quadstore.getApproximateSize(importedTerms, opts);
    }
    async sparql(query, opts) {
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isString(query), 'The "query" argument is not an array.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const results = await this.sparqlStream(query, opts);
        switch (results.type) {
            case "bindings":
                {
                    const bindings = await utils.streamToArray(results.iterator);
                    return { ...results, items: bindings };
                }
                break;
            case "void":
                {
                    return results;
                }
                break;
            case "quads": {
                const quads = await utils.streamToArray(results.iterator);
                return { ...results, items: quads };
            }
            default:
                throw new Error(`Unsupported results type "${results.type}"`);
        }
    }
    async put(quads, opts = {}) {
        const importedQuads = Array.isArray(quads)
            ? quads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph))
            : serialization.importQuad(quads, this.quadstore.defaultGraph);
        return await this.quadstore.put(importedQuads, opts);
    }
    async del(patternOrOldQuads, opts) {
        let importedPatternOrOldQuads;
        if (Array.isArray(patternOrOldQuads)) {
            importedPatternOrOldQuads = patternOrOldQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph));
        }
        else if (utils.hasAllTerms(patternOrOldQuads)) {
            importedPatternOrOldQuads = serialization.importQuad(patternOrOldQuads, this.quadstore.defaultGraph);
        }
        else {
            importedPatternOrOldQuads = serialization.importPattern(patternOrOldQuads, this.quadstore.defaultGraph);
        }
        return await this.quadstore.del(importedPatternOrOldQuads, opts);
    }
    async get(pattern, opts) {
        const results = await this.getStream(pattern, opts);
        const items = await utils.streamToArray(results.iterator);
        return { type: results.type, items, sorting: results.sorting };
    }
    async patch(matchTermsOrOldQuads, newQuads, opts) {
        let importedPatternOrOldQuads;
        if (Array.isArray(matchTermsOrOldQuads)) {
            importedPatternOrOldQuads = matchTermsOrOldQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph));
        }
        else if (utils.hasAllTerms(matchTermsOrOldQuads)) {
            importedPatternOrOldQuads = serialization.importQuad(matchTermsOrOldQuads, this.quadstore.defaultGraph);
        }
        else {
            importedPatternOrOldQuads = serialization.importPattern(matchTermsOrOldQuads, this.quadstore.defaultGraph);
        }
        const importedNewQuads = Array.isArray(newQuads)
            ? newQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph))
            : serialization.importQuad(newQuads, this.quadstore.defaultGraph);
        return await this.quadstore.patch(importedPatternOrOldQuads, importedNewQuads, opts);
    }
    async search(stages, opts) {
        const importedStages = stages.map(stage => serialization.importSearchStage(stage, this.quadstore.defaultGraph));
        const result = await this.quadstore.search(importedStages, opts);
        switch (result.type) {
            case "quads":
                return { ...result, items: result.items.map(quad => serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory)) };
            case "bindings":
                return { ...result, items: result.items.map(binding => serialization.exportBinding(binding, this.quadstore.defaultGraph, this.dataFactory)) };
            default:
                throw new Error(`Unsupported result type "${result.type}"`);
        }
    }
    async getStream(pattern, opts) {
        if (_.isNil(pattern))
            pattern = {};
        if (_.isNil(opts))
            opts = {};
        assert_1.default(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
        assert_1.default(_.isObject(opts), 'The "opts" argument is not an object.');
        const importedMatchTerms = serialization.importPattern(pattern, this.quadstore.defaultGraph);
        const results = await this.quadstore.getStream(importedMatchTerms, opts);
        return {
            type: "quads",
            iterator: results.iterator.map(this._createQuadDeserializerMapper()),
            sorting: results.sorting,
        };
    }
    async putStream(source, opts) {
        const importedQuadsIterator = asynciterator_1.default.AsyncIterator.wrap(source)
            .map(this._createQuadSerializerMapper());
        return await this.quadstore.putStream(importedQuadsIterator, opts);
    }
    async delStream(source, opts) {
        const importedQuadsIterator = asynciterator_1.default.AsyncIterator.wrap(source)
            .map(this._createQuadSerializerMapper());
        return await this.quadstore.delStream(importedQuadsIterator, opts);
    }
    async searchStream(stages, opts) {
        if (_.isNil(opts))
            opts = {};
        const importedStages = stages.map(stage => serialization.importSearchStage(stage, this.quadstore.defaultGraph));
        const results = await this.quadstore.searchStream(importedStages, opts);
        let iterator;
        switch (results.type) {
            case "bindings":
                iterator = results.iterator.map((binding) => {
                    return serialization.exportBinding(binding, this.quadstore.defaultGraph, this.dataFactory);
                });
                break;
            case "quads":
                iterator = results.iterator.map((quad) => {
                    return serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
                });
                break;
            default:
                throw new Error(`Unsupported result type "${results.type}"`);
        }
        return { ...results, iterator };
    }
    async sparqlStream(query, opts) {
        if (_.isNil(opts))
            opts = {};
        return await sparql.sparqlStream(this, query, opts);
    }
    _createQuadSerializerMapper() {
        return (quad) => {
            return serialization.importQuad(quad, this.quadstore.defaultGraph);
        };
    }
    _createQuadDeserializerMapper() {
        return (quad) => {
            return serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
        };
    }
}
exports.default = RdfStore;
//# sourceMappingURL=rdfstore.js.map