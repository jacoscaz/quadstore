
'use strict';

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const shortid = require('shortid');
const async = require('async');
const AsyncIterator = require('asynciterator');
const quadstore = require('..');

const rdfextFactory = require('rdf-data-model');
const rdflibFactory = require('rdflib').DataFactory;

let termId = 0;
const times = 10000;

function generateBlankNode() {
  return '_:blank' + termId++;
}

function generateBlankNodeTerm(factory) {
  return factory.blankNode('blank' + termId++);
}

function generateNamedNode() {
  return 'http://example.com/term' + termId++;
}

function generateNamedNodeTerm(factory) {
  return factory.namedNode('http://example.com/term' + termId++);
}

function generateLiteral() {
  return '"literal' + termId++ + '"';
}

function generateLiteralTerm(factory) {
  return factory.literal('literal' + termId++);
}

function generateRandom() {
  const random = Math.random();
  if (random < 0.333) return generateBlankNode();
  if (random < 0.666) return generateLiteral();
  return generateNamedNode();
}

function generateRandomTerm(factory) {
  const random = Math.random();
  if (random < 0.333) return generateBlankNodeTerm(factory);
  if (random < 0.666) return generateLiteralTerm(factory);
  return generateNamedNodeTerm(factory);
}

function generateTerms() {
  return {
    subject: generateRandom(),
    predicate: generateNamedNode(),
    object: generateRandom(),
    graph: generateNamedNode()
  };
}

function generateQuad(factory) {
  return factory.quad(
    generateRandomTerm(factory),
    generateNamedNodeTerm(factory),
    generateRandomTerm(factory),
    generateNamedNodeTerm(factory)
  );
}

function createQuadStore() {
  const db = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
  const store = new quadstore.QuadStore(db);
  store._path = db;
  return store;
}

function createRdfStore(dataFactory) {
  const db = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
  const store = new quadstore.RdfStore(db, { dataFactory });
  store._path = db;
  return store;
}

function removeStore(store) {
  store.close((closeErr) => {
    if (closeErr) throw closeErr;
    return fs.removeSync(store._path);
  });
}

function time(name, fn, cb) {
  const now = Date.now();
  fn((err) => {
    if (err) { cb(err); return; }
    const then = Date.now();
    const secs = (then - now) / 1000;
    cb(null, { name, secs });
  });
}

function pad(num, integers, decimals) {
  const str = num.toFixed(decimals) + '';
  const parts = str.split('.');
  return ('0000' + parts[0]).slice(-1 * integers) + '.' + parts[1];
}

async.series(
  [

    (cb) => {
      const store = createQuadStore();
      const quads = new Array(times).fill(true).map(() => generateTerms());
      time(
        'graph / put            ',
        (done) => { async.eachSeries(quads, (quad, eachDone) => { store.put(quad, eachDone); }, done); },
        (err, result) => { removeStore(store); cb(err, result); }
      )
    },

    (cb) => {
      const store = createRdfStore(rdflibFactory);
      const quads = new Array(times).fill(true).map(() => generateQuad(rdflibFactory));
      time(
        'rdf   / import / rdflib',
        (done) => { store.import(new AsyncIterator.ArrayIterator(quads), done); },
        (err, result) => { removeStore(store); cb(err, result); }
      )
    },

    (cb) => {
      const store = createRdfStore(rdfextFactory);
      const quads = new Array(times).fill(true).map(() => generateQuad(rdfextFactory));
      time(
        'rdf   / import / rdfext',
        (done) => { store.import(new AsyncIterator.ArrayIterator(quads), done); },
        (err, result) => { removeStore(store); cb(err, result); }
      )
    }

  ],
  (err, results) => {
    if (err) throw err;
    for (let r = 0, result; r < results.length; r++) {
      result = results[r];
      console.log('%s %s op/s %s s', result.name, pad(times/result.secs, 9, 2), pad(result.secs, 2, 2));
    }
  }
)

