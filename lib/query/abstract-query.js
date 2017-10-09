/* eslint no-this-before-super: off */

'use strict';

const _ = require('lodash');
const assert = require('assert');

let JoinQuery;
let SortQuery;
let UnionQuery;
let FilterQuery;

function isTermName(str) {
  return {
    subject: true,
    predicate: true,
    object: true,
    graph: true
  }[str] || false;
}

function isTermNameArray(arr) {
  for (let i = 0; i < arr.length; i += 1) {
    if (!isTermName(arr[i])) return false;
  }
  return true;
}

class AbstractQuery {

  constructor(store, parent) {
    this._rdfStore = store;
    this._parent = parent;
    this._queryType = 'abstract';
  }

  sort(termNames, reverse) {
    if (_.isNil(reverse)) reverse = false;
    assert(isTermNameArray(termNames), 'The "termNames" argument is not an array of term names.');
    assert(_.isBoolean(reverse), 'The "reverse" argument is not boolean.');
    return new SortQuery(this._rdfStore, this, termNames, reverse);
  }

  join(otherQuery, thisTermNames, otherTermNames, sort) {
    if (_.isBoolean(otherTermNames)) {
      sort = otherTermNames;
      otherTermNames = null;
    }
    if (_.isNil(otherTermNames)) {
      otherTermNames = thisTermNames.slice();
    }
    if (_.isNil(sort)) sort = true;
    assert(_.isObject(otherQuery), 'The "query" argument is not a query.');
    assert(_.isString(otherQuery._queryType), 'The "query" argument is not a query.');
    assert(isTermNameArray(thisTermNames), 'The "termNames" argument is not an array of term names.');
    assert(isTermNameArray(otherTermNames), 'The "termNames" argument is not an array of term names.');
    assert(_.isBoolean(sort), 'The "sort" argument is not a boolean value.');
    return new JoinQuery(this._rdfStore, this, otherQuery, thisTermNames, otherTermNames, sort);
  }

  union(query) {
    assert(_.isObject(query) && _.isString(query._queryType), 'The "query" argument is not a query.');
    return new UnionQuery(this._rdfStore, this, query);
  }

  filter(fn) {
    assert(_.isFunction(fn), 'The "fn" argument is not a function.');
    return new FilterQuery(this._rdfStore, this, fn);
  }

  get(cb) {
    const query = this;
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    function _toArray(resolve, reject) {
      const quads = [];
      query._execute()
        .on('data', (quad) => { quads.push(quad); })
        .on('end', () => { resolve(quads); })
        .on('error', (streamErr) => { reject(streamErr); });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_toArray);
    }
    _toArray(cb.bind(null, null), cb);
  }

  del(cb) {
    const query = this;
    const store = query._rdfStore;
    assert(_.isNil(cb) || _.isFunction(cb), 'The "cb" argument is not a function.');
    function _del(resolve, reject) {
      query.get((getErr, quads) => {
        if (getErr) { reject(getErr); return; }
        store.del(quads, (delErr) => {
          if (delErr) reject(delErr);
          else resolve();
        });
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_del);
    }
    _del(cb.bind(null, null), cb);
  }

  getStream() {
    return this._execute();
  }

  toArray(cb) {
    return this.get(cb);
  }

  _execute() {
    throw new Error('This is an instance of AbstractQuery() and cannot be executed.');
  }

}

module.exports = AbstractQuery;

JoinQuery = require('./join-query');
SortQuery = require('./sort-query');
UnionQuery = require('./union-query');
FilterQuery = require('./filter-query');
