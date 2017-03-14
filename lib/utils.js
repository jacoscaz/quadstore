
'use strict';

function consume(readable, cb) {
  function noop() {}
  function read() {
    const chunk = readable.read();
    if (chunk === null) {
      readable.once('readable', read);
      return;
    }
    cb(chunk, read);
  }
  readable.once('end', () => {
    cb(null, noop);
  });
  setTimeout(read);
  return readable;
}

module.exports.consume = consume;

function toArray(readable, cb) {
  const chunks = [];
  consume(readable, (chunk, consumeCb) => {
    if (!chunk) { cb(null, chunks); return; }
    chunks.push(chunk);
    consumeCb();
  });
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
