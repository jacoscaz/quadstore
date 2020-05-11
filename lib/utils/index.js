
'use strict';

const _ = require('./lodash');

function wait(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

module.exports.wait = wait;

function streamToArray(readStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readStream
      .on('data', (chunk) => { chunks.push(chunk); })
      .on('end', () => { resolve(chunks); })
      .on('error', (err) => { reject(err); });
  });
}

module.exports.streamToArray = streamToArray;

function streamToString(readStream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    readStream
      .on('data', (chunk) => { buffer += chunk.toString(); })
      .on('end', () => { resolve(buffer); })
      .on('error', (err) => { reject(err); });
  });
}

module.exports.streamToString = streamToString;

function isReadableStream(obj) {
  return _.isObject(obj)
    && _.isFunction(obj.on)
    && _.isFunction(obj.read);
}

module.exports.isReadableStream = isReadableStream;

function isPromise(obj) {
  return _.isObject(obj)
    && _.isFunction(obj.then);
}

module.exports.isPromise = isPromise;

function isAbstractLevelDownClass(obj) {
  return _.isFunction(obj)
    && _.isFunction(obj.prototype.batch)
    && _.isFunction(obj.prototype.iterator);
}

module.exports.isAbstractLevelDownClass = isAbstractLevelDownClass;

function isAbstractLevelDOWNInstance(obj) {
  return _.isObject(obj)
    && _.isFunction(obj.put)
    && _.isFunction(obj.del)
    && _.isFunction(obj.batch);
}

module.exports.isAbstractLevelDOWNInstance = isAbstractLevelDOWNInstance;

function isDataFactory(obj) {
  return (_.isObject(obj) || _.isFunction(obj))
    && _.isFunction(obj.literal)
    && _.isFunction(obj.defaultGraph)
    && _.isFunction(obj.blankNode)
    && _.isFunction(obj.namedNode)
    && _.isFunction(obj.variable)
    && _.isFunction(obj.triple)
    && _.isFunction(obj.quad);
}

module.exports.isDataFactory = isDataFactory;

function resolveOnEvent(emitter, event, rejectOnError) {
  return new Promise((resolve, reject) => {
    emitter.on(event, resolve);
    if (rejectOnError) {
      emitter.on('error', reject);
    }
  });
}

module.exports.resolveOnEvent = resolveOnEvent;
module.exports.waitForEvent = resolveOnEvent;

function wrapError(err, message) {
  const wrapperError = new Error(message);
  wrapperError.stack += '\nCaused by:' + err.stack;
  return wrapperError;
}

module.exports.wrapError = wrapError;

function defineReadOnlyProperty(obj, key, value) {
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    enumerable: true,
    configurable: true
  });
}

module.exports.defineReadOnlyProperty = defineReadOnlyProperty;

function noop() {}

module.exports.noop = noop;

function hasAllTerms(coll, contextKey) {
  if (typeof(coll) !== 'object') throw new Error('not an object');
  const found = {};
  const terms = Array.isArray(coll) ? coll : Object.keys(coll);
  if (terms.length !== 4) {
    return false;
  }
  for (let t = 0; t < terms.length; t += 1) {
    switch (terms[t]) {
      case 'subject':
      case 'predicate':
      case 'object':
      case contextKey:
        if (found[terms[t]]) {
          return false;
        }
        found[terms[t]] = true;
        break;
      default:
        return false;
    }
  }
  return true;
}

module.exports.hasAllTerms = hasAllTerms;

function genDefaultIndexes(contextKey) {
  return [
    ['subject', 'predicate', 'object', contextKey],
    ['object', contextKey, 'subject', 'predicate'],
    [contextKey, 'subject', 'predicate', 'object'],
    ['object', 'subject', 'predicate', contextKey],
    ['predicate', 'object', contextKey, 'subject'],
    [contextKey, 'predicate', 'object', 'subject'],
    ['predicate', 'object', 'subject', contextKey], // TODO remove
  ];
}

module.exports.genDefaultIndexes = genDefaultIndexes;

module.exports.nanoid = require('./nanoid');

const createIteratorMeta = (bindings, sorting, approximateCount) => {
  return {
    sorting,
    bindings,
    approximateCount,
  };
};

module.exports.createIteratorMeta = createIteratorMeta;
