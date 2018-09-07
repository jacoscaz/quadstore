
'use strict';

const _ = require('lodash');
const utils = require('../lib/utils');
const should = require('should');
const dataFactory = require('n3').DataFactory;

module.exports = () => {

  describe('RdfStore.prototype.sparql()', () => {

    it('Shoud return the correct number of entries', async function () {
      const ctx = this;
      const store = ctx.store;
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
      const bindings = await utils.streamToArray(await ctx.store.sparql(query));
      should(bindings).have.length(20);
    });

    it('Shoud return the correct number of entries (LIMIT)', async function () {
      const ctx = this;
      const store = ctx.store;
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
      const bindings = await utils.streamToArray(await ctx.store.sparql(query));
      should(bindings).have.length(132);
    });

    it('Shoud match the correct number of entries', async function () {
      const ctx = this;
      const store = ctx.store;
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
      const bindings = await utils.streamToArray(await ctx.store.sparql(query));
      should(bindings).have.length(10);
    });

    it('Should filter quads correctly by comparing integers', async function () {
      const XSD = 'http://www.w3.org/2001/XMLSchema#';
      const store = this.store;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p3'),
          dataFactory.literal('8', `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p0'),
          dataFactory.literal('1', `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p1'),
          dataFactory.literal('3', `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal('5', `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        )
      ];
      await store.put(quads);
      const query = 'SELECT * WHERE { GRAPH ?g { ?s ?p ?o. FILTER (?o >= 4) } }';
      const bindings = await utils.streamToArray(await store.sparql(query));
      should(bindings).have.length(2);
    });

    it('Should filter quads correctly by comparing timestamps as integers', async function () {
      const XSD = 'http://www.w3.org/2001/XMLSchema#';
      const store = this.store;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal(new Date('2017-01-02T00:00:00Z').valueOf(), `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p3'),
          dataFactory.literal(new Date('2017-01-01T00:00:00Z').valueOf(), `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p0'),
          dataFactory.literal(new Date('2017-01-01T12:00:00Z').valueOf(), `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p1'),
          dataFactory.literal(new Date('2017-01-01T16:00:00Z').valueOf(), `${XSD}integer`),
          dataFactory.namedNode('http://ex.com/g0')
        )
      ];
      await store.put(quads);
      const query1 = `SELECT * WHERE { GRAPH ?g { ?s ?p ?o. FILTER (?o >= ${new Date('2017-01-01T16:01:00Z').valueOf()}) } }`;
      const bindings1 = await utils.streamToArray(await store.sparql(query1));
      should(bindings1).have.length(1);
      const query2 = `SELECT * WHERE { GRAPH ?g { ?s ?p ?o. FILTER (?o >= ${new Date('2017-01-01T16:00:00Z').valueOf()}) } }`;
      const bindings2 = await utils.streamToArray(await store.sparql(query2));
      should(bindings2).have.length(2);
    });

  });

};
