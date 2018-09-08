
'use strict';

const n3 = require('n3');
const ldf = require('ldf-client');
const utils = require('../lib/utils');
const should = require('should');

ldf.Logger.prototype.log = function () {};

const { namedNode, literal, defaultGraph, quad } = n3.DataFactory;

module.exports = () => {

  describe('RdfStore\'s LDF endpoint', () => {

    beforeEach(async function () {
      const quads = [
        quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), defaultGraph()),
        quad(namedNode('ex://s1'), namedNode('ex://p0'), namedNode('ex://o1'), namedNode('ex://g1')),
        quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o1'), namedNode('ex://g2')),
      ];
      await this.store.put(quads);
      this.client = new ldf.FragmentsClient(`${this.store._httpBaseUrl}/ldf`);
    });

    it('Should answer query targeting the default graph', async function () {
      const query = 'SELECT ?s ?o WHERE { ?s <ex://p0> ?o }';
      const results = await utils.streamToArray(new ldf.SparqlIterator(query, {fragmentsClient: this.client}));
      should(results).have.length(1);
    });

    it('Should answer query targeting the union graph', async function () {
      const query = 'SELECT ?g ?s ?o WHERE { GRAPH ?g {?s <ex://p0> ?o } }';
      const results = await utils.streamToArray(new ldf.SparqlIterator(query, {fragmentsClient: this.client}));
      should(results).have.length(2);
    });

  });

};
