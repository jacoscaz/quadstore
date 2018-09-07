
'use strict';

const n3 = require('n3');
const url = require('url');
const http = require('http');
const should = require('should');
const Promise = require('bluebird');

const { namedNode, literal, defaultGraph, quad } = n3.DataFactory;

async function serializeQuads(quads, format) {
  return new Promise((resolve, reject) => {
    const writer = n3.Writer({ format });
    writer.addQuads(quads);
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function deserializeQuads(data, format) {
  return new Promise((resolve, reject) => {
    const parser = n3.Parser({ format });
    const quads = [];
    parser.parse(data, (err, quad) => {
      if (err) reject(err);
      else if (!quad) resolve(quads);
      else quads.push(quad);
    });
  });
}

async function get(targetUrl, acceptedFormat) {
  return new Promise((resolve, reject) => {
    const opts = typeof(targetUrl) === 'string'
      ? url.parse(targetUrl)
      : targetUrl;
    if (acceptedFormat) {
      if (!opts.headers) {
        opts.headers = {};
      }
      opts.headers.accept = acceptedFormat;
    }
    http.get(targetUrl, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Bad status code (${res.statusCode}).`));
        return;
      }
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => { resolve([buf, res.headers['content-type']]); });
    });
  });
}

async function getQuads(targetUrl) {
  const [payload, format] = await get(targetUrl);
  return deserializeQuads(payload, format);
}

async function postQuads(targetUrl, quads, format) {
  if (!format) format = 'application/trig';
  const payload = await serializeQuads(quads, format);
  return new Promise((resolve, reject) => {
    const opts = url.parse(targetUrl);
    opts.headers = { 'Content-Type': format };
    opts.method = 'POST';
    const req = http.request(opts, (res) => {
      res.resume();
      if (res.statusCode !== 200) {
        reject(new Error('Bad status code.'));
        return;
      }
      res.on('error', (err) => { reject(err); });
      res.on('end', () => { resolve(); });
    });
    req.on('error', (err) => { reject(err); });
    req.write(payload);
    req.end();
  });
}

module.exports = () => {

  describe('RdfStore HTTP API', () => {

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
