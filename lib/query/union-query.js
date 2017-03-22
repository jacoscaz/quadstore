
'use strict';

const async = require('async');
const AbstractQuery = require('./abstract-query');

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
        (done) => { query._other.execute(done); },
        (done) => { query._parent.execute(done); },
      ],
      (err, readStreams) => {
        if (err) { cb(err); return; }
        cb(null, readStreams[1].prepend(readStreams[0]));
      }
    );
  }

}

module.exports = UnionQuery;
