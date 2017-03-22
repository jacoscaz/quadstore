/* eslint no-this-before-super: off */

'use strict';

const SortedArray = require('collections/sorted-array');
const ArrayIterator = require('asynciterator').ArrayIterator;
const AbstractQuery = require('./abstract-query');

class SortQuery extends AbstractQuery {

  constructor(store, parent, termNames, reverse) {
    super(store, parent);
    this._queryType = 'sort';
    this._termNames = termNames;
    this._reverse = reverse;
  }

  _execute(cb) {
    const query = this;
    const store = this._store;
    query._parent._execute((executeErr, readStream) => {
      if (executeErr) { cb(executeErr); return; }
      const sortedArr = new SortedArray(
        [],
        store._createEqualComparator(),
        store._createOrderComparator()
      );
      readStream
        .on('data', (quad) => {
          sortedArr.add(quad);
        })
        .on('end', () => {
          const quads = sortedArr.toArray();
          if (query._reverse) quads.reverse();
          cb(null, ArrayIterator(quads));
        })
        .on('error', (err) => {
          cb(err);
        });
    });
  }

}

module.exports = SortQuery;
