/* eslint no-this-before-super: off */

'use strict';

const async = require('async');
const Readable = require('stream').Readable;
const AbstractQuery = require('./abstract-query');

class IntersectStream extends Readable {

  constructor(A, B, equal, compare) {
    super({ objectMode: true });
    this._A = A;
    this._B = B;
    this._equal = equal;
    this._compare = compare;
  }

  _read() {

    const stream = this;

    const A = this._A;
    const B = this._B;

    let currentA;
    let currentB;

    let finished = false;

    A.on('end', () => {
      if (!finished) {
        finished = true;
        stream.push(null);
      }
    });

    B.on('end', () => {
      if (!finished) {
        finished = true;
        stream.push(null);
      }
    });

    function read(updateA, updateB) {

      if (updateA) currentA = A.read();
      if (updateB) currentB = B.read();

      if (!currentA) {
        A.on('readable', () => { read(true, false); });
        return;
      }

      if (!currentB) {
        B.on('readable', () => { read(false, true); });
        return;
      }

      if (stream._equal(currentA, currentB)) {
        if (stream.push(currentA)) read(true, true);
      } else if (stream._compare(currentA, currentB) < 0) {
        read(true, false);
      } else {
        read(false, true);
      }

    }

    read(true, true);

  }
}

class IntersectQuery extends AbstractQuery {

  constructor(store, parent, other, termNames) {
    super(store, parent);
    this._queryType = 'intersect';
    this._other = other;
    this._termNames = termNames;
  }

  _execute(cb) {
    const query = this;
    const store = this._store;
    async.parallel(
      [
        (done) => { query._parent.sort(query._termNames)._execute(done); },
        (done) => { query._other.sort(query._termNames)._execute(done); },
      ],
      (err, readStreams) => {
        if (err) { cb(err); return; }
        const equalComparator = store._createEqualComparator();
        const orderComparator = store._createOrderComparator();
        cb(null, new IntersectStream(readStreams[0], readStreams[1], equalComparator, orderComparator));
      }
    );
  }

}

module.exports = IntersectQuery;
