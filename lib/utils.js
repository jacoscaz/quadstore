
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
  readable.once('end', () => { cb(null, noop); });
  readable.once('readable', read);
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
