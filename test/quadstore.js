/* eslint global-require: "off" */

'use strict';

const utils = require('../dist/lib/utils');
const dataFactory = require('@rdfjs/data-model');
const {Quadstore} = require('..');

module.exports = () => {

  describe('Quadstore', () => {

    beforeEach(async function () {
      this.store = new Quadstore({
        dataFactory,
        backend: this.db,
        indexes: this.indexes,
        prefixes: this.prefixes,
      });
      await this.store.open();
    });

    afterEach(async function () {
      await this.store.close();
    });

    require('./quadstore.prototype.del')();
    require('./quadstore.prototype.get')();
    require('./quadstore.prototype.get.literals')();
    require('./quadstore.prototype.patch')();
    require('./quadstore.prototype.put')();
    require('./quadstore.prototype.match')();
    require('./quadstore.prototype.sparql')();
    require('./quadstore.prototype.remove')();
    require('./quadstore.prototype.import')();
    require('./quadstore.prototype.removematches')();

  });
};
