
'use strict';

const _ = require('lodash');
const utils = require('../lib/utils');
const should = require('should');
const QuadStore = require('..').QuadStore;

module.exports = () => {

  describe('QuadStore', () => {

    beforeEach(async function () {
      this.store = new QuadStore(this.db);
      await utils.waitForEvent(this.store, 'ready');
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
