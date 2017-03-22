/* eslint no-this-before-super: off */

'use strict';

const _ = require('lodash');

let SortQuery;
let UnionQuery;
let IntersectQuery;

class AbstractQuery {

  constructor(store, parent) {
    this._store = store;
    this._parent = parent;
    this._queryType = 'abstract';
  }

  union(query) {
    return new UnionQuery(this._store, this, query);
  }

  sort(termNames, reverse) {
    return new SortQuery(this._store, this, termNames, reverse);
  }

  intersect(query, termNames) {
    return new IntersectQuery(this._store, this, query, termNames);
  }

  toReadableStream(cb) {
    const query = this;
    function _toReadableStream(resolve, reject) {
      query._execute((executeErr, readableStream) => {
        if (executeErr) { reject(executeErr); return; }
        resolve(readableStream);
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_toReadableStream);
    }
    _toReadableStream(cb.bind(null, null), cb);
  }

  toArray(cb) {
    const query = this;
    function _toArray(resolve, reject) {
      const quads = [];
      query._execute((executeErr, readableStream) => {
        if (executeErr) { reject(executeErr); return; }
        readableStream
          .on('data', (quad) => { quads.push(quad); })
          .on('end', () => { resolve(quads); })
          .on('error', (streamErr) => { reject(streamErr); });
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_toArray);
    }
    _toArray(cb.bind(null, null), cb);
  }

  _execute(cb) {
    cb(new Error('This is an instance of AbstractQuery() and cannot be executed.'));
  }

}

module.exports = AbstractQuery;

SortQuery = require('./sort-query');
UnionQuery = require('./union-query');
IntersectQuery = require('./intersect-query');
