
'use strict';

const _ = require('lodash');
const should = require('should');
const asynctools = require('asynctools');
const QuadStore = require('..').QuadStore;

module.exports = () => {

  describe('QuadStore', () => {

    beforeEach(async function () {
      this.store = new QuadStore(this.db);
      await asynctools.onEvent(this.store, 'ready');
    });

    afterEach(async function () {
      await this.store.close();
    });

    require('./quadstore.prototype.get')();
    require('./quadstore.prototype.put')();
    require('./quadstore.prototype.del')();
    require('./quadstore.prototype.patch')();
    require('./quadstore.prototype.registerindex')();
    require('./quadstore.prototype.getbyindex')();

  });
};
