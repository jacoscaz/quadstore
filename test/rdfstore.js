/* eslint global-require: "off" */


'use strict';

const utils = require('../lib/utils');
const factory = require('rdf-data-model');
const RdfStore = require('..').RdfStore;

module.exports = () => {

  describe('RdfStore', () => {

    beforeEach(async function () {
      this.store = new RdfStore(this.db, { dataFactory: factory });
      await utils.waitForEvent(this.store, 'ready');
    });

    afterEach(async function () {
      await this.store.close();
    });

    require('./rdfstore.prototype.match')();
    require('./rdfstore.prototype.sparql')();
    require('./rdfstore.prototype.del')();
    require('./rdfstore.prototype.remove')();
    require('./rdfstore.prototype.import')();
    require('./rdfstore.prototype.removematches')();

    require('./rdfstore.http')();

  });
};
