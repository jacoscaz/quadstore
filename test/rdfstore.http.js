
'use strict';

const n3 = require('n3');
const url = require('url');
const yurl = require('yurl');
const http = require('http');
const should = require('should');
const Promise = require('bluebird');
const asynctools = require('asynctools');

async function serializeQuads(quads, format) {
  return new Promise((resolve, reject) => {
    const writer = n3.Writer({ format });
    for (const quad of quads) {
      writer.addTriple(quad);
    }
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
        { subject: 'ex://s0', predicate: 'ex://p0', object: 'ex://o0', graph: 'ex://g0' },
        { subject: 'ex://s1', predicate: 'ex://p1', object: 'ex://o1', graph: 'ex://g1' },
        { subject: 'ex://s2', predicate: 'ex://p2', object: 'ex://o2', graph: 'ex://g2' },
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

    it('Should import, match and remove quads correctly', async function () {
      const store = this.store;
      const quads = [
        { subject: 'ex://s0', predicate: 'ex://p0', object: 'ex://o0', graph: 'ex://g0' },
        { subject: 'ex://s1', predicate: 'ex://p1', object: 'ex://o1', graph: 'ex://g1' },
        { subject: 'ex://s2', predicate: 'ex://p2', object: 'ex://o2', graph: 'ex://g2' },
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
        { subject: 'ex://s0', predicate: 'ex://p0', object: 'ex://o0', graph: 'ex://g0' },
        { subject: 'ex://s1', predicate: 'ex://p1', object: '"literal"', graph: 'ex://g1' },
        { subject: 'ex://s2', predicate: 'ex://p2', object: 'ex://o2', graph: 'ex://g2' },
      ];
      await postQuads(`${store._httpBaseUrl}/import`, quads);
      const query = 'SELECT *  WHERE { GRAPH ?g { ?s ?p ?o } }';
      const getOpts = url.parse(`${store._httpBaseUrl}/sparql?query=${encodeURIComponent(query)}`);
      getOpts.headers = { accept: 'application/sparql-results+json' };
      const [payload, format] = await get(getOpts);
      should(format).equal('application/sparql-results+json');
      const expected = {
        head: {
          vars: ['']
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
              o: { value: 'literal', type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#string' },
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
        { subject: 'ex://s0', predicate: 'ex://p0', object: 'ex://o0', graph: 'ex://g0' },
        { subject: 'ex://s1', predicate: 'ex://p1', object: '"literal"', graph: 'ex://g1' },
        { subject: 'ex://s2', predicate: 'ex://p2', object: 'ex://o2', graph: 'ex://g2' },
      ];
      await postQuads(`${store._httpBaseUrl}/import`, quads);
      const query = 'CONSTRUCT { ?s <ex://p3> ?o } WHERE { GRAPH ?g { ?s <ex://p1> ?o } }';
      const getOpts = url.parse(`${store._httpBaseUrl}/sparql?query=${encodeURIComponent(query)}`);
      const results = await getQuads(getOpts);
      const expected = [{ subject:'ex://s1', predicate: 'ex://p3', object: '"literal"^^http://www.w3.org/2001/XMLSchema#string', graph: '' }];
      should(results).deepEqual(expected);
    });

    it('Should answer a CONSTRUCT query correctly with quads implicitly from the default graph', async function () {
      const store = this.store;
      const quads = [
        { subject: 'ex://s0', predicate: 'ex://p0', object: 'ex://o0' },
        { subject: 'ex://s1', predicate: 'ex://p1', object: '"literal"' },
        { subject: 'ex://s2', predicate: 'ex://p2', object: 'ex://o2' },
      ];
      await postQuads(`${store._httpBaseUrl}/import`, quads, 'text/turtle');
      const query = 'CONSTRUCT { ?s <ex://p3> ?o } WHERE { ?s <ex://p1> ?o }';
      const results = await getQuads(url.parse(`${store._httpBaseUrl}/sparql?query=${encodeURIComponent(query)}`));
      const expected = [{ subject:'ex://s1', predicate: 'ex://p3', object: '"literal"^^http://www.w3.org/2001/XMLSchema#string', graph: '' }];
      should(results).deepEqual(expected);
    });

  });

};
