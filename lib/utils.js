
'use strict';

const _ = require('lodash');
const stream = require('stream');

function toArray(readable, cb) {
  const items = [];
  readable
    .on('data', (item) => { items.push(item); })
    .on('end', () => { cb(null, items); });
}

module.exports.toArray = toArray;

function flattenQuad(q) {
  return q.subject + '::' + q.predicate + '::' + q.object + '::' + q.context;
}

function quadSorter(a, b) {
  const flattenedA = flattenQuad(a);
  const flattenedB = flattenQuad(b);
  if (flattenedA === flattenedB) return 0;
  if (flattenedA < flattenedB) return 1;
  return -1;
}

module.exports.quadSorter = quadSorter;

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

function isLevel(obj) {
  return _.isObject(obj)
    && _.isFunction(obj.put)
    && _.isFunction(obj.del)
    && _.isFunction(obj.batch);
}

module.exports.isLevel = isLevel;

function createArrayStream(arr) {
  let i = 0;
  const l = arr.length;
  return new stream.Readable({
    objectMode: true,
    read() {
      this.push(i < l ? arr[i++] : null);
    }
  });
}

module.exports.createArrayStream = createArrayStream;
