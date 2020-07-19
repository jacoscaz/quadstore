"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nanoid = exports.genDefaultIndexes = exports.hasAllTerms = exports.noop = exports.defineReadOnlyProperty = exports.wrapError = exports.waitForEvent = exports.resolveOnEvent = exports.isDataFactory = exports.isAbstractLevelDOWNInstance = exports.isAbstractLevelDownClass = exports.isPromise = exports.isReadableStream = exports.streamToString = exports.streamToArray = exports.termNames = exports.wait = void 0;
const lodash_1 = require("./lodash");
const nanoid_1 = __importDefault(require("./nanoid"));
exports.nanoid = nanoid_1.default;
exports.wait = (delay) => {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
};
exports.termNames = ['subject', 'predicate', 'object', 'graph'];
exports.streamToArray = (readStream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readStream
            .on('data', (chunk) => { chunks.push(chunk); })
            .on('end', () => { resolve(chunks); })
            .on('error', (err) => { reject(err); });
    });
};
exports.streamToString = (readStream) => {
    return new Promise((resolve, reject) => {
        let buffer = '';
        readStream
            .on('data', (chunk) => {
            // @ts-ignore
            buffer += chunk.toString();
        })
            .on('end', () => {
            resolve(buffer);
        })
            .on('error', (err) => {
            reject(err);
        });
    });
};
exports.isReadableStream = (obj) => {
    return lodash_1.isObject(obj)
        && lodash_1.isFunction(obj.on)
        && lodash_1.isFunction(obj.read);
};
exports.isPromise = (obj) => {
    return lodash_1.isObject(obj)
        && lodash_1.isFunction(obj.then);
};
exports.isAbstractLevelDownClass = (obj) => {
    return lodash_1.isFunction(obj)
        && lodash_1.isFunction(obj.prototype.batch)
        && lodash_1.isFunction(obj.prototype.iterator);
};
exports.isAbstractLevelDOWNInstance = (obj) => {
    return lodash_1.isObject(obj)
        && lodash_1.isFunction(obj.put)
        && lodash_1.isFunction(obj.del)
        && lodash_1.isFunction(obj.batch);
};
exports.isDataFactory = (obj) => {
    return (lodash_1.isObject(obj) || lodash_1.isFunction(obj))
        && lodash_1.isFunction(obj.literal)
        && lodash_1.isFunction(obj.defaultGraph)
        && lodash_1.isFunction(obj.blankNode)
        && lodash_1.isFunction(obj.namedNode)
        && lodash_1.isFunction(obj.variable)
        && lodash_1.isFunction(obj.triple)
        && lodash_1.isFunction(obj.quad);
};
exports.resolveOnEvent = (emitter, event, rejectOnError) => {
    return new Promise((resolve, reject) => {
        emitter.on(event, resolve);
        if (rejectOnError) {
            emitter.on('error', reject);
        }
    });
};
exports.waitForEvent = exports.resolveOnEvent;
exports.wrapError = (err, message) => {
    const wrapperError = new Error(message);
    wrapperError.stack += '\nCaused by:' + err.stack;
    return wrapperError;
};
exports.defineReadOnlyProperty = (obj, key, value) => {
    Object.defineProperty(obj, key, {
        value,
        writable: false,
        enumerable: true,
        configurable: true
    });
};
exports.noop = () => { };
exports.hasAllTerms = (coll) => {
    return typeof (coll) === 'object'
        && 'subject' in coll
        && 'predicate' in coll
        && 'object' in coll
        && 'graph' in coll;
};
exports.genDefaultIndexes = () => {
    return [
        ['subject', 'predicate', 'object', 'graph'],
        ['object', 'graph', 'subject', 'predicate'],
        ['graph', 'subject', 'predicate', 'object'],
        ['object', 'subject', 'predicate', 'graph'],
        ['predicate', 'object', 'graph', 'subject'],
        ['graph', 'predicate', 'object', 'subject'],
    ];
};
//# sourceMappingURL=index.js.map