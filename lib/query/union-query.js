
'use strict';

const async = require('async');
const AbstractQuery = require('./abstract-query');
const SimpleTransformIterator = require('asynciterator').SimpleTransformIterator;

class UnionQuery extends AbstractQuery {

  constructor(store, parent, other) {
    super(store, parent);
    this._queryType = 'union';
    this._other = other;
  }

  _execute(cb) {
    const query = this;
    async.parallel(
      [
        (done) => { query._other._execute(done); },
        (done) => { query._parent._execute(done); },
      ],
      (err, readStreams) => {
        if (err) { cb(err); return; }
        const otherIterator = new SimpleTransformIterator(readStreams[0]);
        const parentIterator = new SimpleTransformIterator(readStreams[1]);
        cb(null, otherIterator.prepend(parentIterator));
      }
    );
  }

}

module.exports = UnionQuery;
