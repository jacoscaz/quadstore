/* eslint no-this-before-super: off */

'use strict';

const async = require('async');
const Readable = require('stream').Readable;
const AbstractQuery = require('./abstract-query');

class JoinStream extends Readable {

  constructor(A, B, equal, compare) {
    super({ objectMode: true });
    const stream = this;
    this._A = A;
    this._B = B;
    this._currentA = null;
    this._currentB = null;
    this._endedA = false;
    this._endedB = false;
    this._equal = equal;
    this._compare = compare;
    this._reading = false;
    function onEnd() {
      if (stream._endedA && stream._endedB) {
        stream.push(null);
      }
    }
    A.on('end', () => { stream._endedA = true; onEnd(); });
    B.on('end', () => { stream._endedB = true; onEnd(); });
  }

  _read() {
    const stream = this;
    if (stream._reading) return;
    function read(updateA, updateB) {
      if (updateA) stream._currentA = stream._A.read();
      if (updateB) stream._currentB = stream._B.read();
      if (!stream._currentA) {
        stream._A.once('readable', () => { read(true, false); });
        stream._reading = false;
        return;
      }
      if (!stream._currentB) {
        stream._B.once('readable', () => { read(false, true); });
        stream._reading = false;
        return;
      }
      if (stream._equal(stream._currentA, stream._currentB)) {
        if (stream.push(stream._currentA)) {
          read(true, true);
        } else {
          stream.reading = false;
        }
      } else if (stream._compare(stream._currentA, stream._currentB) < 0) {
        read(true, false);
      } else {
        read(false, true);
      }
    }
    stream._reading = true;
    read(true, true);
  }
}

class JoinQuery extends AbstractQuery {

  constructor(store, parent, other, termNames, sort) {
    super(store, parent);
    this._queryType = 'join';
    this._other = other;
    this._termNames = termNames;
    this._sort = sort;
  }

  _execute(cb) {
    const query = this;
    const store = this._store;
    function finalCb(err, readStreams) {
      if (err) { cb(err); return; }
      const equalComparator = store._createEqualComparator();
      const orderComparator = store._createOrderComparator();
      cb(null, new JoinStream(readStreams[0], readStreams[1], equalComparator, orderComparator));
    }
    if (query._sort) {
      async.parallel([
        (done) => { query._parent.sort(query._termNames)._execute(done); },
        (done) => { query._other.sort(query._termNames)._execute(done); }
      ], finalCb);
    } else {
      async.parallel([
        (done) => { query._parent._execute(done); },
        (done) => { query._other._execute(done); }
      ], finalCb);
    }
  }

}

module.exports = JoinQuery;
