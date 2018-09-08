
'use strict';

const n3 = require('n3');
const url = require('url');
const should = require('should');
const testUtils = require('./utils');

const { namedNode, literal, defaultGraph, quad } = n3.DataFactory;
const { get, getQuads, postQuads, serializeQuads, deserializerQuads } = testUtils;

module.exports = () => {

  describe('RdfStore\'s HTTP SPARQL endpoint', () => {

    it('Should provide a correct response to a SPARQL query', async function () {
      const store = this.store;
      const quads = [
        quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), namedNode('ex://g0')),
        quad(namedNode('ex://s1'), namedNode('ex://p1'), literal('literal'), namedNode('ex://g1')),
        quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o2'), namedNode('ex://g2')),
      ];
      await postQuads(`${store._httpBaseUrl}/import`, quads);
      const query = 'SELECT *  WHERE { GRAPH ?g { ?s ?p ?o } }';
      const getOpts = url.parse(`${store._httpBaseUrl}/sparql?query=${encodeURIComponent(query)}`);
      getOpts.headers = { accept: 'application/sparql-results+json' };
      const [payload, format] = await get(getOpts);
      should(format).equal('application/sparql-results+json');
      const expected = {
        head: {
          vars: ['s', 'p', 'o', 'g']
        },
        results: {
          bindings: [
            {
              s: { value: 'ex://s0', type: 'uri' },
              p: { value: 'ex://p0', type:'uri' },
              o: { value: 'ex://o0', type: 'uri' },
              g: { value:'ex://g0', type:'uri' }
            },
            {
              s: { value: 'ex://s1', type: 'uri' },
              p: { value: 'ex://p1', type:'uri' },
              o: { value: 'literal', type: 'literal' },
              g: { value:'ex://g1', type:'uri' }
            },
            {
              s: { value: 'ex://s2', type: 'uri' },
              p: { value: 'ex://p2', type:'uri' },
              o: { value: 'ex://o2', type:'uri' },
              g: { value:'ex://g2', type:'uri' }
            }
          ]
        }
      };
      should(JSON.parse(payload)).deepEqual(expected);
    });

    it('Should answer a CONSTRUCT query correctly with quads explicitly from named graphs', async function () {
      const store = this.store;
      const quads = [
        quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), namedNode('ex://g0')),
        quad(namedNode('ex://s1'), namedNode('ex://p1'), literal('literal'), namedNode('ex://g1')),
        quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o2'), namedNode('ex://g2')),
      ];
      await postQuads(`${store._httpBaseUrl}/import`, quads);
      const query = 'CONSTRUCT { ?s <ex://p3> ?o } WHERE { GRAPH ?g { ?s <ex://p1> ?o } }';
      const results = await getQuads(`${store._httpBaseUrl}/sparql?query=${encodeURIComponent(query)}`);
      const expected = [quad(namedNode('ex://s1'), namedNode('ex://p3'), literal('literal'), defaultGraph())];
      should(results).deepEqual(expected);
    });

    it('Should answer a CONSTRUCT query correctly with quads implicitly from the default graph', async function () {
      const store = this.store;
      const quads = [
        quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), defaultGraph()),
        quad(namedNode('ex://s1'), namedNode('ex://p1'), literal('literal'), defaultGraph()),
        quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o2'), defaultGraph()),
      ];
      await postQuads(`${store._httpBaseUrl}/import`, quads);
      const query = 'CONSTRUCT { ?s <ex://p3> ?o } WHERE { ?s <ex://p1> ?o }';
      const results = await getQuads(`${store._httpBaseUrl}/sparql?query=${encodeURIComponent(query)}`);
      const expected = [quad(namedNode('ex://s1'), namedNode('ex://p3'), literal('literal'), defaultGraph())];
      should(results).deepEqual(expected);
    });

  });

};
