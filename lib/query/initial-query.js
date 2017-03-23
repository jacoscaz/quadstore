/* eslint no-this-before-super: off */

'use strict';

const AbstractQuery = require('./abstract-query');

class InitialQuery extends AbstractQuery {

  constructor(store, readStream) {
    super(store, null);
    this._queryType = 'initial';
    this._readStream = readStream;
  }

  _execute(cb) {
    return cb(null, this._readStream);
  }

}

module.exports = InitialQuery;
