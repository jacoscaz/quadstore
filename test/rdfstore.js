/* eslint global-require: "off" */


'use strict';

const factory = require('rdf-data-model');
const RdfStore = require('..').RdfStore;
const asynctools = require('asynctools');

module.exports = () => {

  describe('RdfStore', () => {

    beforeEach(async function () {
      this.store = new RdfStore(this.db, { dataFactory: factory });
      await asynctools.onEvent(this.store, 'ready');
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
