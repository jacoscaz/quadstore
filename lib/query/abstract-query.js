/* eslint no-this-before-super: off */

'use strict';

const _ = require('lodash');

let JoinQuery;
let SortQuery;
let UnionQuery;
let FilterQuery;

class AbstractQuery {

  constructor(store, parent) {
    this._store = store;
    this._parent = parent;
    this._queryType = 'abstract';
  }

  sort(termNames, reverse) {
    return new SortQuery(this._store, this, termNames, reverse);
  }

  join(query, termNames) {
    return new JoinQuery(this._store, this, query, termNames);
  }

  union(query) {
    return new UnionQuery(this._store, this, query);
  }

  filter(fn) {
    return new FilterQuery(this._store, this, fn);
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

JoinQuery = require('./join-query');
SortQuery = require('./sort-query');
UnionQuery = require('./union-query');
FilterQuery = require('./filter-query');
