
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

async function getQuads(targetUrl) {
  const [payload, format] = await (new Promise((resolve, reject) => {
    http.get(targetUrl, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('Bad status code.'));
        return;
      }
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => { resolve([buf, res.contentType]); });
    });
  }));
  return deserializeQuads(payload, format);
}

async function postQuads(targetUrl, quads) {
  const format = 'application/trig';
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

  });

};
