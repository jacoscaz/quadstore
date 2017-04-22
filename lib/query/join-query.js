/* eslint no-this-before-super: off */

'use strict';

const _ = require('lodash');
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
    this._reading = false;
    function onEnd() {
      joinStream.push(null);
      if (!joinStream._endedA) drain(joinStream._B);
      if (!joinStream._endedB) drain(joinStream._A);
    }
    A.on('end', () => { joinStream._endedA = true; onEnd(); });
    B.on('end', () => { joinStream._endedB = true; onEnd(); });
  }

  _read() {
    const js = this;
    if (js._reading) return;
    js._reading = true;
    function __read(readA, readB) {
      if (js._endedA || js._endedB) {
        js._reading = false;
        return;
      }
      if (readA) {
        js._currentA = js._A.read();
        if (_.isNil(js._currentA)) {
          js._A.once('readable', () => { __read(true, _.isNil(js._currentB)); });
          return;
        }
      }
      if (readB) {
        js._currentB = js._B.read();
        if (_.isNil(js._currentB)) {
          js._B.once('readable', () => { __read(_.isNil(js._currentA), true); });
          return;
        }
      }
      if (js._equal(js._currentA, js._currentB)) {
        const keepReading = js.push(js._currentA);
        if (keepReading) {
          __read(true, true);
        } else {
          js._reading = false;
        }
      } else if (js._compare(js._currentA, js._currentB) < 0) {
        __read(true, false);
      } else {
        __read(false, true);
      }
    }
    __read(true, true);
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

  _execute() {
    const store = this._store;
    let parentStream;
    let otherStream;
    if (this._sort) {
      parentStream = this._parent.sort(this._termNames)._execute();
      otherStream = this._other.sort(this._termNames)._execute();
    } else {
      parentStream = this._parent._execute();
      otherStream = this._other._execute();
    }
    const equalComparator = store._createEqualComparator(this._termNames);
    const orderComparator = store._createOrderComparator(this._termNames);
    return new JoinStream(parentStream, otherStream, equalComparator, orderComparator);
  }

}

module.exports = JoinQuery;
