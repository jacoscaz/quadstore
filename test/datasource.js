
'use strict';

const _ = require('lodash');
const os = require('os');
const fs = require('fs-extra');
const ldf = require('../lib/ldf');
const path = require('path');
const shortid = require('shortid');
const levelup = require('leveldown');
const ldfClient = require('ldf-client');
const RdfStore = require('../').RdfStore;
const dataFactory = require('rdf-data-model');

function wait(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

function streamToArray(readStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readStream
      .on('data', (chunk) => { chunks.push(chunk); })
      .on('end', () => { resolve(chunks); })
      .on('error', (err) => { reject(err); });
  });
}

describe.only('LDF Datasource', () => {

  beforeEach(async function () {
    const ctx = this;
    ctx.location = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
    ctx.store = new RdfStore(ctx.location, { dataFactory });
    ctx.server = ldf.initLdfServer(ctx.store);
    await new Promise((resolve, reject) => {
      ctx.server.listen(8883, (err) => {
        err ? reject(err) : resolve();
      });
    });
    ctx.client = new ldfClient.FragmentsClient('http://127.0.0.1:8883/rdfstore#dataset');
  });

  afterEach(async function () {
    const ctx = this;
    await new Promise((resolve, reject) => {
      ctx.store.close((closeErr) => {
        closeErr ? reject(closeErr) : resolve();
      });
    });
    await fs.remove(ctx.location);
  });

  it('LDF', async function () {
    this.timeout(0);
    const ctx = this;
    for (let i = 0; i < 1000; i++) {
      await ctx.store.put(dataFactory.quad(
        dataFactory.namedNode('http://ex.com/s' + i),
        dataFactory.namedNode('http://ex.com/p' + i),
        dataFactory.namedNode('http://ex.com/o' + i),
        dataFactory.namedNode('http://ex.com/g' + i)
      ));
    }
    await wait(300 * 1000);
    const query = 'SELECT * { ?s ?p ?o }';
    const results = await streamToArray(new ldfClient.SparqlIterator(query, { fragmentsClient: ctx.client }));
    console.log(results);
  });

});