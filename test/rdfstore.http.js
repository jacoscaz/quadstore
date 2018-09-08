
'use strict';

const n3 = require('n3');
const url = require('url');
const should = require('should');
const testUtils = require('./utils');

const { namedNode, literal, defaultGraph, quad } = n3.DataFactory;
const { get, getQuads, postQuads, serializeQuads, deserializerQuads } = testUtils;

module.exports = () => {

  describe('RdfStore\'s HTTP endpoints', () => {

    describe('RdfStore\'s RDF/JS-equivalent HTTP endpoints', () => {

      it('Should import, match and remove quads correctly', async function () {
        const store = this.store;
        const quads = [
          quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), namedNode('ex://g0')),
          quad(namedNode('ex://s1'), namedNode('ex://p1'), namedNode('ex://o1'), namedNode('ex://g1')),
          quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o2'), namedNode('ex://g2')),
        ];
        await postQuads(`${store._httpBaseUrl}/import`, quads);
        const matchedQuads1 = await getQuads(`${store._httpBaseUrl}/match`);
        should(matchedQuads1).have.length(3);
        await postQuads(`${store._httpBaseUrl}/remove`, quads.slice(0, 1));
        const matchedQuads2 = await getQuads(`${store._httpBaseUrl}/match`);
        should(matchedQuads2).have.length(2);
        const matchedQuads3 = await getQuads(`${store._httpBaseUrl}/match?subject=${encodeURIComponent('ex://s2')}`);
        should(matchedQuads3).have.length(1);
      });

    });

    require('./rdfstore.http.ldf')();
    require('./rdfstore.http.sparql')();

  });

};
