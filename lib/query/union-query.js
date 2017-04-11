
'use strict';

const async = require('async');
const stream = require('stream');
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
        (done) => { query._other._execute(done); },
        (done) => { query._parent._execute(done); },
      ],
      (err, readStreams) => {
        if (err) { cb(err); return; }
        const otherStream = readStreams[0];
        const parentStream = readStreams[1];
        const throughStream = new stream.PassThrough({ objectMode: true });
        parentStream.pipe(throughStream, { end: false });
        parentStream.on('end', () => {
          otherStream.pipe(throughStream);
        });
        cb(null, throughStream);
      }
    );
  }

}

module.exports = UnionQuery;
