/* eslint no-this-before-super: off */

'use strict';

const async = require('async');
const stream = require('stream');
const AbstractQuery = require('./abstract-query');

function drain(source) {
  source.on('data', () => {});
}

class JoinStream extends stream.Readable {

  constructor(A, B, equal, compare) {
    super({ objectMode: true });
    const joinStream = this;
    this._A = A;
    this._B = B;
    this._currentA = null;
    this._currentB = null;
    this._endedA = false;
    this._endedB = false;
    this._equal = equal;
    this._compare = compare;
    function onEnd() {
      joinStream.push(null);
      if (!joinStream._endedA) drain(joinStream._B);
      if (!joinStream._endedB) drain(joinStream._A);
    }
    A.on('end', () => { joinStream._endedA = true; onEnd(); });
    B.on('end', () => { joinStream._endedB = true; onEnd(); });
  }

  _read() {
    const joinStream = this;
    if (this._endedA || this._endedB) return;
    if (!this._currentA) this._currentA = this._A.read();
    if (!this._currentB) this._currentB = this._B.read();
    if (!this._currentA) {
      this._A.once('readable', () => { joinStream._read(); });
      return;
    }
    if (!this._currentB) {
      this._B.once('readable', () => { joinStream._read(); });
      return;
    }
    if (this._equal(this._currentA, this._currentB)) {
      const keepReading = this.push(this._currentA);
      this._currentA = null;
      this._currentB = null;
      if (keepReading) this._read();
    } else if (this._compare(this._currentA, this._currentB) < 0) {
      this._currentA = null;
      this._read();
    } else {
      this._currentB = null;
      this._read();
    }
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
      const equalComparator = store._createEqualComparator(query._termNames);
      const orderComparator = store._createOrderComparator(query._termNames);
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
