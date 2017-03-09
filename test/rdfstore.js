
'use strict';

const fs = require('fs-extra');
const path = require('path');
const should = require('should');
const shortid = require('shortid');
const factory = require('rdf-data-model');
const RdfStore = require('..').RdfStore;
const storeUtils = require('../lib/utils');
const AsyncIterator = require('asynciterator');

let db;
let rs;

beforeEach((done) => {
  db = path.join(process.cwd(), 'node-quadstore-' + shortid.generate());
  fs.ensureDir(db, (err) => {
    if (err) { done(err); return; }
    rs = new RdfStore(db, { dataFactory: factory });
    done();
  });
});

afterEach((done) => {
  fs.remove(db, done);
});

describe('QuadStore', () => {

  const quads = [
    factory.quad(
      factory.namedNode('http://ex.com/s'),
      factory.namedNode('http://ex.com/p'),
      factory.literal('o', 'en-gb'),
      factory.blankNode('g')
    )
  ];

  it('should import a single quad correctly', (done) => {
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      storeUtils.toArray(rs.match(), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0].subject).deepEqual(quads[0].subject);
        should(matchedQuads[0].predicate).deepEqual(quads[0].predicate);
        should(matchedQuads[0].object).deepEqual(quads[0].object);
        should(matchedQuads[0].graph.value).deepEqual(quads[0].graph.value);
        should(matchedQuads[0].graph.termType).deepEqual(quads[0].graph.termType);
        done();
      });
    });
  });

});
