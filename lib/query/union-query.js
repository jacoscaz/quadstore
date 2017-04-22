
'use strict';

const stream = require('stream');
const AbstractQuery = require('./abstract-query');

class UnionQuery extends AbstractQuery {

  constructor(store, parent, other) {
    super(store, parent);
    this._queryType = 'union';
    this._other = other;
  }

  _execute() {
    const throughStream = new stream.PassThrough({ objectMode: true });
    setImmediate(() => {
      const otherStream = this._other._execute();
      const parentStream = this._parent._execute();
      parentStream.pipe(throughStream, { end: false });
      parentStream.on('end', () => {
        parentStream.unpipe(throughStream);
        otherStream.pipe(throughStream);
      });
    });
    return throughStream;
  }

}

module.exports = UnionQuery;
