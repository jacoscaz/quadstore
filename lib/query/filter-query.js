/* eslint no-this-before-super: off */

'use strict';

const AbstractQuery = require('./abstract-query');
const SimpleTransformIterator = require('asynciterator').SimpleTransformIterator;

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
      cb(null, new SimpleTransformIterator(readStream, { filter: query._filter }));
    });
  }

}

module.exports = FilterQuery;
