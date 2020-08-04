
'use strict';

const _ = require('../dist-cjs/lib/utils');
const utils = require('../dist-cjs/lib/utils');
const QuadStore = require('..').QuadStore;

module.exports = () => {

  describe('QuadStore', () => {

    beforeEach(async function () {
      this.store = new QuadStore({
        backend: this.db,
        indexes: this.indexes,
      });
      await utils.waitForEvent(this.store, 'ready');
    });

    afterEach(async function () {
      await this.store.close();
    });

    require('./quadstore.counting')();
    require('./quadstore.prototype.get')();
    require('./quadstore.prototype.getstream')();
    require('./quadstore.prototype.searchstream')();
    require('./quadstore.prototype.put')();
    require('./quadstore.prototype.multiput')();
    require('./quadstore.prototype.del')();
    require('./quadstore.prototype.patch')();

  });

};
