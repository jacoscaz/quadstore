
'use strict';

const utils = require('../lib/utils');
const should = require('should');
const memdown = require('memdown');
const shortid = require('shortid');
const factory = require('rdf-data-model');
const RdfStore = require('..').RdfStore;
const AsyncIterator = require('asynciterator');

describe('RdfStore', () => {

  let rs;

  beforeEach(() => {
    rs = new RdfStore(shortid.generate(), { db: memdown, dataFactory: factory });
  });

  describe('RdfStore.prototype.import()', () => {

    it('should import a single quad correctly', (done) => {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o', 'en-gb'),
          factory.namedNode('http://ex.com/g')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
          if (arrayErr) { done(arrayErr); return; }
          should(matchedQuads).have.length(1);
          should(matchedQuads[0]).deepEqual(quads[0]);
          done();
        });
      });
    });

    it('should import multiple quads correctly', (done) => {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s0'),
          factory.namedNode('http://ex.com/p0'),
          factory.literal('o0', 'en-gb'),
          factory.namedNode('http://ex.com/g0')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s1'),
          factory.namedNode('http://ex.com/p1'),
          factory.literal('o1', 'en-gb'),
          factory.namedNode('http://ex.com/g1')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('o2', 'en-gb'),
          factory.namedNode('http://ex.com/g3')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
          if (arrayErr) { done(arrayErr); return; }
          should(matchedQuads).have.length(3);
          should(matchedQuads[0]).deepEqual(quads[0]);
          should(matchedQuads[1]).deepEqual(quads[1]);
          should(matchedQuads[2]).deepEqual(quads[2]);
          done();
        });
      });
    });

  });

  describe('RdfStore.prototype.match()', () => {

    it('should match quads by subject', (done) => {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o', 'en-gb'),
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o', 'en-gb'),
          factory.namedNode('http://ex.com/g')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        const subject = factory.namedNode('http://ex.com/s2');
        utils.toArray(rs.match(subject), (arrayErr, matchedQuads) => {
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
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('o', 'en-gb'),
          factory.namedNode('http://ex.com/g')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        const predicate = factory.namedNode('http://ex.com/p2');
        utils.toArray(rs.match(null, predicate), (arrayErr, matchedQuads) => {
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
          factory.namedNode('http://ex.com/g2')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o2', 'en-gb'),
          factory.namedNode('http://ex.com/g2')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        const object = factory.literal('o2', 'en-gb');
        utils.toArray(rs.match(null, null, object), (arrayErr, matchedQuads) => {
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
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o', 'en-gb'),
          factory.namedNode('http://ex.com/g2')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        const graph = factory.namedNode('http://ex.com/g2');
        utils.toArray(rs.match(null, null, null, graph), (arrayErr, matchedQuads) => {
          if (arrayErr) { done(arrayErr); return; }
          should(matchedQuads).have.length(1);
          should(matchedQuads[0]).deepEqual(quads[1]);
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
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('o2', 'en-gb'),
          factory.namedNode('http://ex.com/g')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        const subject = factory.namedNode('http://ex.com/s');
        utils.toArray(rs.match(subject), (arrayErr, matchedQuads) => {
          if (arrayErr) {
            done(arrayErr);
            return;
          }
          should(matchedQuads).have.length(2);
          should(matchedQuads[0].subject).deepEqual(subject);
          should(matchedQuads[1].subject).deepEqual(subject);
          done();
        });
      });
    });

    it('should match the default graph (explicit)', (done) => {
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
        utils.toArray(rs.match(null, null, null, factory.defaultGraph()), (arrayErr, matchedQuads) => {
          if (arrayErr) { done(arrayErr); return; }
          should(matchedQuads).have.length(1);
          should(matchedQuads[0].graph.value).be.exactly('');
          should(matchedQuads[0]).deepEqual(quads[0]);
          done();
        });
      });
    });

    it('should match the default graph (implicit)', (done) => {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o', 'en-gb')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      rs.import(source, { sync: true }, (importErr) => {
        if (importErr) { done(importErr); return; }
        const readStream = rs.match(factory.namedNode('http://ex.com/s'), null, null, factory.defaultGraph());
        utils.toArray(readStream, (arrayErr, matchedQuads) => {
          if (arrayErr) { done(arrayErr); return; }
          should(matchedQuads).have.length(1);
          should(matchedQuads[0].graph).deepEqual(quads[0].graph);
          done();
        });
      });
    });

  });

  describe('RdfStore.prototype.getdelput()', () => {
    it('should match quads by subject, delete and insert', (done) => {
      const oldQuads = [
        factory.quad(
          factory.namedNode('http://ex.com/s0'),
          factory.namedNode('http://ex.com/p0'),
          factory.literal('o0', 'en-gb'),
          factory.namedNode('http://ex.com/g0')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s1'),
          factory.namedNode('http://ex.com/p1'),
          factory.literal('o1', 'en-gb'),
          factory.namedNode('http://ex.com/g1')
        )
      ];
      const newQuads = [
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('o2', 'en-gb'),
          factory.namedNode('http://ex.com/g2')
        )
      ];
      const matchTerms = { subject: factory.namedNode('http://ex.com/s0') };
      const source = new AsyncIterator.ArrayIterator(oldQuads);
      rs.import(source, (importErr) => {
        if (importErr) { done(importErr); return; }
        rs.getdelput(matchTerms, newQuads, (getdelputErr) => {
          if (getdelputErr) { done(getdelputErr); return; }
          utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
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

});
