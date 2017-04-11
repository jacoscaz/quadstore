/* eslint no-this-before-super: off */

'use strict';

const stream = require('stream');
const SortedArray = require('collections/sorted-array');
const AbstractQuery = require('./abstract-query');

function createArrayStream(arr) {
  let i = 0;
  const l = arr.length;
  return new stream.Readable({
    objectMode: true,
    read() {
      this.push(i < l ? arr[i++] : null);
    }
  });
}

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
          cb(null, createArrayStream(quads));
        })
        .on('error', (err) => {
          cb(err);
        });
    });
  }

}

module.exports = SortQuery;
