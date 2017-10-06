/* eslint no-this-before-super: off */

'use strict';

const utils = require('../utils');
const stream = require('stream');
const SortedArray = require('collections/sorted-array');
const AbstractQuery = require('./abstract-query');

class SortQuery extends AbstractQuery {

  constructor(store, parent, termNames, reverse) {
    super(store, parent);
    this._queryType = 'sort';
    this._termNames = termNames;
    this._reverse = reverse;
  }

  _execute() {
    const query = this;
    const store = this._rdfStore;
    const comparator = store._createQuadComparator(query._termNames);
    const throughStream = new stream.PassThrough({ objectMode: true });
    setImmediate(() => {
      const sortedArr = new SortedArray([], comparator, comparator);
      query._parent._execute()
        .on('data', (quad) => { sortedArr.add(quad); })
        .on('end', () => {
          const quads = sortedArr.toArray();
          if (query._reverse) quads.reverse();
          utils.createArrayStream(quads).pipe(throughStream);
        })
        .on('error', (err) => { throughStream.emit('error', err); });
    });
    return throughStream;
  }

}

module.exports = SortQuery;
