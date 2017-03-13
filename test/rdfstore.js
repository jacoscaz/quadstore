
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
  rs.close((closeErr) => {
    if (closeErr) { done(closeErr); return; }
    fs.remove(db, done);
  });
});

describe('RdfStore', () => {

  it('should import a single quad correctly', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      storeUtils.toArray(rs.match(), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[0]);
        done();
      });
    });
  });

  it('should match quads by subject', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      ),
      factory.quad(
        factory.namedNode('http://ex.com/s2'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      const subject = factory.namedNode('http://ex.com/s2');
      storeUtils.toArray(rs.match(subject), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
        done();
      });
    });
  });

  it('should match quads by predicate', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      ),
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p2'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      const predicate = factory.namedNode('http://ex.com/p2');
      storeUtils.toArray(rs.match(null, predicate), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
        done();
      });
    });
  });

  it('should match quads by object', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      ),
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o2', 'en-gb'),
        factory.blankNode('g')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      const object = factory.literal('o2', 'en-gb');
      storeUtils.toArray(rs.match(null, null, object), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
        done();
      });
    });
  });

  it('should match quads by graph', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      ),
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g2')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      const graph = factory.blankNode('g2');
      storeUtils.toArray(rs.match(null, null, null, graph), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
        done();
      });
    });
  });

  it('should match multiple quads by subject', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.blankNode('g')
      ),
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p2'),
        factory.literal('o2', 'en-gb'),
        factory.blankNode('g2')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      const subject = factory.namedNode('http://ex.com/s');
      storeUtils.toArray(rs.match(subject), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(2);
        should(matchedQuads[0].subject).deepEqual(subject);
        should(matchedQuads[1].subject).deepEqual(subject);
        done();
      });
    });
  });

  it('should import and match the default graph (explicit)', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb'),
        factory.defaultGraph()
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      storeUtils.toArray(rs.match(), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0].graph.value).be.exactly('');
        should(matchedQuads[0]).deepEqual(quads[0]);
        done();
      });
    });
  });

  it('should import and match the default graph (implicit)', (done) => {
    const quads = [
      factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('o', 'en-gb')
      )
    ];
    const source = new AsyncIterator.ArrayIterator(quads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      storeUtils.toArray(rs.match(null, null, null, factory.defaultGraph()), (arrayErr, matchedQuads) => {
        if (arrayErr) { done(arrayErr); return; }
        should(matchedQuads).have.length(1);
        should(matchedQuads[0].graph.value).be.exactly('');
        should(matchedQuads[0]).deepEqual(quads[0]);
        done();
      });
    });
  });

  it('should match quads by subject, delete and insert', (done) => {
    const oldQuads = [
      factory.quad(
        factory.namedNode('http://ex.com/s0'),
        factory.namedNode('http://ex.com/p0'),
        factory.literal('o0', 'en-gb'),
        factory.blankNode('g0')
      ),
      factory.quad(
        factory.namedNode('http://ex.com/s1'),
        factory.namedNode('http://ex.com/p1'),
        factory.literal('o1', 'en-gb'),
        factory.blankNode('g1')
      )
    ];
    const newQuads = [
      factory.quad(
        factory.namedNode('http://ex.com/s2'),
        factory.namedNode('http://ex.com/p2'),
        factory.literal('o2', 'en-gb'),
        factory.blankNode('g2')
      )
    ];
    const matchTerms = { subject: factory.namedNode('http://ex.com/s0') };
    const source = new AsyncIterator.ArrayIterator(oldQuads);
    rs.import(source, (importErr) => {
      if (importErr) { done(importErr); return; }
      rs.getdelput(matchTerms, newQuads, (getdelputErr) => {
        if (getdelputErr) { done(getdelputErr); return; }
        storeUtils.toArray(rs.match(), (arrayErr, matchedQuads) => {
          if (arrayErr) {
            done(arrayErr);
            return;
          }
          should(matchedQuads).have.length(2);
          should(matchedQuads[0]).deepEqual(oldQuads[1]);
          should(matchedQuads[1]).deepEqual(newQuads[0]);
          done();
        });
      });
    });
  });

});
