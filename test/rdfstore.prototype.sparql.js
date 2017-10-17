
'use strict';

const _ = require('lodash');
const utils = require('../lib/utils');
const should = require('should');

module.exports = () => {

  describe('RdfStore.prototype.sparql()', () => {

    it('Shoud return the correct number of entries', async function () {
      const ctx = this;
      const store = ctx.store;
      const dataFactory = store.dataFactory;
      const quads = [];
      for (let i = 0; i < 20; i++) {
        quads.push(dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s' + i),
          dataFactory.namedNode('http://ex.com/p' + i),
          dataFactory.namedNode('http://ex.com/o' + i),
          dataFactory.namedNode('http://ex.com/g' + i)
        ));
      }
      await store.put(quads);
      const query = 'SELECT *  WHERE { GRAPH ?g { ?s ?p ?o } }';
      const results = await utils.streamToArray(ctx.store.sparql(query));
      should(results).have.length(20);
    });

    it('Shoud return the correct number of entries (LIMIT)', async function () {
      const ctx = this;
      const store = ctx.store;
      const dataFactory = store.dataFactory;
      const quads = [];
      for (let i = 0; i < 200; i++) {
        quads.push(dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s' + i),
          dataFactory.namedNode('http://ex.com/p' + i),
          dataFactory.namedNode('http://ex.com/o' + i),
          dataFactory.namedNode('http://ex.com/g' + i)
        ));
      }
      await store.put(quads);
      const query = 'SELECT *  WHERE { GRAPH ?g { ?s ?p ?o } } LIMIT 132';
      const results = await utils.streamToArray(ctx.store.sparql(query));
      should(results).have.length(132);
    });

    it('Shoud match the correct number of entries', async function () {
      const ctx = this;
      const store = ctx.store;
      const dataFactory = store.dataFactory;
      const quads = [];
      for (let i = 0; i < 200; i++) {
        quads.push(dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s' + (i % 10)),
          dataFactory.namedNode('http://ex.com/p' + (i % 20)),
          dataFactory.namedNode('http://ex.com/o' + (i % 50)),
          dataFactory.namedNode('http://ex.com/g' + i)
        ));
      }
      await store.put(quads);
      const query = 'SELECT *  WHERE { GRAPH ?g { <http://ex.com/s0> <http://ex.com/p0> ?o } }';
      const results = await utils.streamToArray(ctx.store.sparql(query));
      should(results).have.length(10);
    });

  });

};
