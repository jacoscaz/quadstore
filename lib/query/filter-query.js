/* eslint no-this-before-super: off */

'use strict';

const stream = require('stream');
const AbstractQuery = require('./abstract-query');

function createFilterStream(fn) {
  return new stream.Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(quad, enc, cb) {
      if (fn(quad)) this.push(quad);
      cb();
    }
  });
}

class FilterQuery extends AbstractQuery {

  constructor(store, parent, filter) {
    super(store, parent);
    this._queryType = 'filter';
    this._filter = filter;
  }

  _execute(cb) {
    const query = this;
    query._parent._execute((executeErr, readStream) => {
      if (executeErr) { cb(executeErr); return; }
      cb(null, readStream.pipe(createFilterStream(query._filter)));
    });
  }

}

module.exports = FilterQuery;
