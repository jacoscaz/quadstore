
'use strict';

const _ = require('lodash');
const utils = require('../lib/utils');
const should = require('should');
const stream = require('stream');
const factory = require('rdf-data-model');

function stripTermSerializedValue(quads) {
  const _quads = _.isArray(quads) ? quads : [quads];
  quads.forEach((quad) => {
    ['subject', 'predicate', 'object', 'graph'].forEach((termKey) => {
      delete quad[termKey]._serializedValue;
    });
  });
  return _.isArray(quads) ? _quads : _quads[0];
}

function createArrayStream(arr) {
  let i = 0;
  const l = arr.length;
  return new stream.Readable({
    objectMode: true,
    read() {
      this.push(i < l ? arr[i++] : null);
    }
  });
}

module.exports = function () {

  let rs;

  beforeEach(function () {
    rs = this.store;
  });

  describe('RDF/JS interface', () => {

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
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            const subject = factory.namedNode('http://ex.com/s2');
            utils.toArray(rs.match(subject), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
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
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            const predicate = factory.namedNode('http://ex.com/p2');
            utils.toArray(rs.match(null, predicate), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
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
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            const object = factory.literal('o2', 'en-gb');
            utils.toArray(rs.match(null, null, object), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
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
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            const graph = factory.namedNode('http://ex.com/g2');
            utils.toArray(rs.match(null, null, null, graph), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
              should(matchedQuads).have.length(1);
              should(matchedQuads[0]).deepEqual(quads[1]);
              done();
            });
          });
      });

      it('should match the default graph (explicit)', (done) => {
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb'),
            factory.defaultGraph()
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            utils.toArray(rs.match(null, null, null, factory.defaultGraph()), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
              should(matchedQuads).have.length(1);
              should(matchedQuads[0]).deepEqual(quads[0]);
              done();
            });
          });
      });

      it('should match quads by the default graph (implicit)', (done) => {
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            const readStream = rs.match(null, null, null, factory.defaultGraph());
            utils.toArray(readStream, (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
              should(matchedQuads).have.length(1);
              should(matchedQuads[0].graph).deepEqual(quads[0].graph);
              done();
            });
          });
      });

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
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
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
        const source = createArrayStream(quads);
        rs.import(source)
          .on('error', done)
          .on('end', () => {
            utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
              if (arrayErr) {
                done(arrayErr);
                return;
              }
              stripTermSerializedValue(matchedQuads);
              should(matchedQuads).have.length(3);
              should(matchedQuads[0]).deepEqual(quads[0]);
              should(matchedQuads[1]).deepEqual(quads[1]);
              should(matchedQuads[2]).deepEqual(quads[2]);
              done();
            });
          });
      });

    });

    describe('RdfStore.prototype.remove()', () => {

      it('should remove streamed quads correctly', (done) => {
        const importQuads = [
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
        const removeQuads = [
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
        const importStream = createArrayStream(importQuads);
        const removeStream = createArrayStream(removeQuads);
        rs.import(importStream)
          .on('error', done)
          .on('end', () => {
            rs.remove(removeStream)
              .on('error', done)
              .on('end', () => {
                utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
                  if (arrayErr) {
                    done(arrayErr);
                    return;
                  }
                  stripTermSerializedValue(matchedQuads);
                  should(matchedQuads).have.length(1);
                  should(matchedQuads[0]).deepEqual(importQuads[0]);
                  done();
                });
              });
          });
      });

    });

    describe('RdfStore.prototype.removeMatches()', () => {

      it('should remove matching quads correctly', (done) => {
        const importQuads = [
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
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const importStream = createArrayStream(importQuads);
        rs.import(importStream)
          .on('error', done)
          .on('end', () => {
            rs.removeMatches(null, null, null, factory.namedNode('http://ex.com/g1'))
              .on('error', done)
              .on('end', () => {
                utils.toArray(rs.match(), (arrayErr, matchedQuads) => {
                  if (arrayErr) {
                    done(arrayErr);
                    return;
                  }
                  stripTermSerializedValue(matchedQuads);
                  should(matchedQuads).have.length(1);
                  should(matchedQuads[0]).deepEqual(importQuads[0]);
                  done();
                });
              });
          });
      });

    });

  });

  describe('Graph Interface', () => {

    describe('RdfStore.prototype.query()', () => {

      it('Should query correctly.', () => {

        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb'),
            factory.namedNode('http://ex.com/g0')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o2', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];

        return rs.put(quads)
          .then(() => {
            return rs.query({ subject: factory.namedNode('http://ex.com/s0') })
              .join(rs.query({ predicate: factory.namedNode('http://ex.com/p1') }), ['predicate'])
              .toArray();
          })
          .then((foundQuads) => {
            stripTermSerializedValue(foundQuads);
            should(foundQuads).have.length(1);
            should(foundQuads[0]).deepEqual(quads[1]);
          });
      });

    });

  });

};
