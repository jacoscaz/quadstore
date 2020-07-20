"use strict";
exports.__esModule = true;
exports.nanoid = exports.genDefaultIndexes = exports.hasAllTerms = exports.noop = exports.defineReadOnlyProperty = exports.wrapError = exports.waitForEvent = exports.resolveOnEvent = exports.isDataFactory = exports.isAbstractLevelDOWNInstance = exports.isAbstractLevelDownClass = exports.isPromise = exports.isReadableStream = exports.streamToString = exports.streamToArray = exports.termNames = exports.wait = void 0;
var lodash_1 = require("./lodash");
var nanoid_1 = require("./nanoid");
exports.nanoid = nanoid_1["default"];
exports.wait = function (delay) {
    return new Promise(function (resolve) {
        setTimeout(resolve, delay);
    });
};
exports.termNames = ['subject', 'predicate', 'object', 'graph'];
exports.streamToArray = function (readStream) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        readStream
            .on('data', function (chunk) { chunks.push(chunk); })
            .on('end', function () { resolve(chunks); })
            .on('error', function (err) { reject(err); });
    });
};
exports.streamToString = function (readStream) {
    return new Promise(function (resolve, reject) {
        var buffer = '';
        readStream
            .on('data', function (chunk) {
            // @ts-ignore
            buffer += chunk.toString();
        })
            .on('end', function () {
            resolve(buffer);
        })
            .on('error', function (err) {
            reject(err);
        });
    });
};
exports.isReadableStream = function (obj) {
    return lodash_1.isObject(obj)
        && lodash_1.isFunction(obj.on)
        && lodash_1.isFunction(obj.read);
};
exports.isPromise = function (obj) {
    return lodash_1.isObject(obj)
        && lodash_1.isFunction(obj.then);
};
exports.isAbstractLevelDownClass = function (obj) {
    return lodash_1.isFunction(obj)
        && lodash_1.isFunction(obj.prototype.batch)
        && lodash_1.isFunction(obj.prototype.iterator);
};
exports.isAbstractLevelDOWNInstance = function (obj) {
    return lodash_1.isObject(obj)
        && lodash_1.isFunction(obj.put)
        && lodash_1.isFunction(obj.del)
        && lodash_1.isFunction(obj.batch);
};
exports.isDataFactory = function (obj) {
    return (lodash_1.isObject(obj) || lodash_1.isFunction(obj))
        && lodash_1.isFunction(obj.literal)
        && lodash_1.isFunction(obj.defaultGraph)
        && lodash_1.isFunction(obj.blankNode)
        && lodash_1.isFunction(obj.namedNode)
        && lodash_1.isFunction(obj.variable)
        && lodash_1.isFunction(obj.triple)
        && lodash_1.isFunction(obj.quad);
};
exports.resolveOnEvent = function (emitter, event, rejectOnError) {
    return new Promise(function (resolve, reject) {
        emitter.on(event, resolve);
        if (rejectOnError) {
            emitter.on('error', reject);
        }
    });
};
exports.waitForEvent = exports.resolveOnEvent;
exports.wrapError = function (err, message) {
    var wrapperError = new Error(message);
    wrapperError.stack += '\nCaused by:' + err.stack;
    return wrapperError;
};
exports.defineReadOnlyProperty = function (obj, key, value) {
    Object.defineProperty(obj, key, {
        value: value,
        writable: false,
        enumerable: true,
        configurable: true
    });
};
exports.noop = function () { };
exports.hasAllTerms = function (coll) {
    return typeof (coll) === 'object'
        && 'subject' in coll
        && 'predicate' in coll
        && 'object' in coll
        && 'graph' in coll;
};
exports.genDefaultIndexes = function () {
    return [
        ['subject', 'predicate', 'object', 'graph'],
        ['object', 'graph', 'subject', 'predicate'],
        ['graph', 'subject', 'predicate', 'object'],
        ['object', 'subject', 'predicate', 'graph'],
        ['predicate', 'object', 'graph', 'subject'],
        ['graph', 'predicate', 'object', 'subject'],
    ];
};
