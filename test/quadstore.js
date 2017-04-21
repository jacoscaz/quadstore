
'use strict';

const utils = require('../lib/utils');
const should = require('should');
const shortid = require('shortid');
const memdown = require('memdown');
const QuadStore = require('..').QuadStore;

module.exports = () => {

  let qs;

  beforeEach(function () {
    qs = this.store;
  });

  describe('QuadStore.prototype.put()', () => {

    it('should store a single quad correctly (as object) (cb)', (done) => {
      const newQuad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      qs.put(newQuad, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({}, (err, foundQuads) => {
          if (err) { done(err); return; }
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuad);
          done();
        });
      });
    });

    it('should store a single quad correctly (as object) (promise)', () => {
      const newQuad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      return qs.put(newQuad)
        .then(() => {
          return qs.get({});
        })
        .then((foundQuads) => {
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuad);
        });
    });

    it('should store a single quad correctly (as array) (cb)', (done) => {
      const newQuads = [{ subject: 's', predicate: 'p', object: 'o', graph: 'c' }];
      qs.put(newQuads, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({}, (getErr, foundQuads) => {
          if (getErr) { done(getErr); return; }
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuads[0]);
          done();
        });
      });
    });

    it('should store a single quad correctly (as array) (promise)', () => {
      const newQuads = [{ subject: 's', predicate: 'p', object: 'o', graph: 'c' }];
      return qs.put(newQuads)
        .then(() => {
          return qs.get({});
        })
        .then((foundQuads) => {
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuads[0]);
        });
    });

    it('should store multiple quads correctly (cb)', (done) => {
      const newQuads = [
        { subject: 's0', predicate: 'p0', object: 'o0', graph: 'c0' },
        { subject: 's1', predicate: 'p1', object: 'o1', graph: 'c1' }
      ];
      qs.put(newQuads, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({}, (err, foundQuads) => {
          if (err) { done(err); return; }
          should(foundQuads).have.length(2);
          should(foundQuads[0]).deepEqual(newQuads[0]);
          should(foundQuads[1]).deepEqual(newQuads[1]);
          done();
        });
      });
    });

    it('should store multiple quads correctly (promise)', () => {
      const newQuads = [
        { subject: 's0', predicate: 'p0', object: 'o0', graph: 'c0' },
        { subject: 's1', predicate: 'p1', object: 'o1', graph: 'c1' }
      ];
      return qs.put(newQuads)
        .then(() => {
          return qs.get({});
        })
        .then((foundQuads) => {
          should(foundQuads).have.length(2);
          should(foundQuads[0]).deepEqual(newQuads[0]);
          should(foundQuads[1]).deepEqual(newQuads[1]);
        });
    });

    it('should not duplicate quads (cb)', (done) => {
      const newQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' }
      ];
      qs.put(newQuads, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({}, (getErr, foundQuads) => {
          if (getErr) { done(getErr); return; }
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuads[0]);
          done();
        });
      });
    });

    it('should not duplicate quads (promise)', () => {
      const newQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' }
      ];
      return qs.put(newQuads)
        .then(() => {
          return qs.get({});
        })
        .then((foundQuads) => {
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuads[0]);
        });
    });

  });

  describe('QuadStore.prototype.del()', () => {

    it('should delete a quad correctly (cb)', (done) => {
      const quad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      qs.put(quad, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({}, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          qs.del(quads[0], (delErr) => {
            if (delErr) { done(delErr); return; }
            qs.get({}, (getErr, quadsAfterDelete) => {
              if (getErr) { done(getErr); return; }
              should(quadsAfterDelete).have.length(0);
              done();
            });
          });
        });
      });
    });

    it('should delete a quad correctly (promise)', () => {
      const quad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      return qs.put(quad)
        .then(() => {
          return qs.get({});
        })
        .then((quads) => {
          should(quads).have.length(1);
          return qs.del(quads[0]);
        })
        .then(() => {
          return qs.get({});
        })
        .then((quadsAfterDelete) => {
          should(quadsAfterDelete).have.length(0);
        });
    });

  });

  describe('QuadStore.prototype.patch()', () => {

    const quadsSamples = [
      { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
      { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
      { subject: 's2', predicate: 'p', object: 'o', graph: 'c' },
      { subject: 's2', predicate: 'p', object: 'o2', graph: 'c' },
      { subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' },
    ];

    it('should delete old quads and add new ones (cb)', (done) => {
      const quadsArray = quadsSamples;
      const oldQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
      ];
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', graph: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', graph: 'c1' },
      ];
      const expected = quadsSamples.slice(2).concat(newQuads);
      qs.put(quadsArray, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.patch(oldQuads, newQuads, (patchErr) => {
          if (patchErr) { done(patchErr); return; }
          qs.get({}, (getErr, quads) => {
            if (getErr) { done(getErr); return; }
            newQuads.sort(utils.quadSorter);
            quads.sort(utils.quadSorter);
            should(quads).have.length(expected.length);
            should(quads).be.deepEqual(expected.sort(utils.quadSorter));
            done();
          });
        });
      });
    });

    it('should delete old quads and add new ones (promise)', () => {
      const quadsArray = quadsSamples;
      const oldQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
      ];
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', graph: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', graph: 'c1' },
      ];
      const expected = quadsSamples.slice(2).concat(newQuads);
      return qs.put(quadsArray)
        .then(() => qs.patch(oldQuads, newQuads))
        .then(() => qs.get({}))
        .then((quads) => {
          newQuads.sort(utils.quadSorter);
          quads.sort(utils.quadSorter);
          should(quads).have.length(expected.length);
          should(quads).be.deepEqual(expected.sort(utils.quadSorter));
        });
    });

    it('should delete matching quads and do an insert (cb)', (done) => {
      const quadsArray = quadsSamples;
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', graph: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', graph: 'c1' },
      ];
      qs.put(quadsArray, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.patch({ subject: 's2' }, newQuads, (patchErr) => {
          if (patchErr) { done(patchErr); return; }
          qs.get({}, (getErr, quads) => {
            if (getErr) { done(getErr); return; }
            newQuads.sort(utils.quadSorter);
            quads.sort(utils.quadSorter);
            should(quads).have.length(4);
            should(quads).be.deepEqual(quadsSamples.slice(0, 2).concat(newQuads));
            done();
          });
        });
      });
    });

    it('should delete matching quads and do an insert (promise)', () => {
      const quadsArray = quadsSamples;
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', graph: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', graph: 'c1' },
      ];
      return qs.put(quadsArray)
        .then(() => {
          return qs.patch({ subject: 's2' }, newQuads);
        })
        .then(() => {
          return qs.get({});
        })
        .then((quads) => {
          newQuads.sort(utils.quadSorter);
          quads.sort(utils.quadSorter);
          should(quads).have.length(4);
          should(quads).be.deepEqual(quadsSamples.slice(0, 2).concat(newQuads));
        });
    });

  });

  describe('QuadStore.prototype.get()', () => {

    const quadsSamples = [
      { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
      { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
      { subject: 's2', predicate: 'p', object: 'o', graph: 'c' },
      { subject: 's2', predicate: 'p', object: 'o2', graph: 'c' },
      { subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' },
    ];

    it('should match quads by subject', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by predicate', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ predicate: 'p' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(3);
          done();
        });
      });
    });

    it('should match quads by object', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ object: 'o' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ graph: 'c' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(3);
          done();
        });
      });
    });

    it('should match quads by subject and predicate', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's2', predicate: 'p' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by subject and object', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's2', object: 'o' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          done();
        });
      });
    });

    it('should match quads by subject and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's2', graph: 'c' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by predicate and object', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ predicate: 'p', object: 'o' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by predicate and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ predicate: 'p', graph: 'c' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(3);
          done();
        });
      });
    });

    it('should match quads by object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ object: 'o2', graph: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);

          done();
        });
      });
    });

    it('should match quads by subject, predicate and object', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's', predicate: 'p2', object: 'o2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          done();
        });
      });
    });

    it('should match quads by subject, predicate and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's', predicate: 'p2', graph: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          done();
        });
      });
    });

    it('should match quads by subject, object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's', object: 'o2', graph: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          done();
        });
      });
    });

    it('should match quads by predicate, object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ predicate: 'p2', object: 'o2', graph: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by subject, predicate, object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          should(quads[0]).deepEqual(quadsSamples[4]);
          done();
        });
      });
    });

  });

  describe('QuadStore.prototype.query()', () => {

    describe('QuadStore.prototype.query().union()', () => {

      it('Should query correctly.', (done) => {
        const quads = [
          { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0' },
          { subject: 's0', predicate: 'p1', object: 'o1', graph: 'g1' },
          { subject: 's2', predicate: 'p2', object: 'o2', graph: 'g2' },
          { subject: 's2', predicate: 'p4', object: 'o3', graph: 'g3' },
          { subject: 's4', predicate: 'p4', object: 'o4', graph: 'g4' },
          { subject: 's5', predicate: 'p5', object: 'o3', graph: 'g5' },
          { subject: 's6', predicate: 'p6', object: 'o6', graph: 'g6' },
          { subject: 's7', predicate: 'p7', object: 'o7', graph: 'g7' },
        ];
        qs.put(quads, (putErr) => {
          if (putErr) { done(putErr); return; }
          const first = qs.query({ subject: 's0' });
          const second = qs.query({ subject: 's2' });
          first.union(second).toArray((err, foundQuads) => {
            if (err) { done(err); return; }
            should(foundQuads).have.length(4);
            should(foundQuads[0]).deepEqual(quads[0]);
            should(foundQuads[1]).deepEqual(quads[1]);
            should(foundQuads[2]).deepEqual(quads[2]);
            should(foundQuads[3]).deepEqual(quads[3]);
            done();
          });
        });
      });

    });

    describe('QuadStore.prototype.query().filter()', () => {
      it('Should filter correctly.', () => {
        const quads = [
          { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0' },
          { subject: 's0', predicate: 'p1', object: 'o1', graph: 'g1' },
          { subject: 's2', predicate: 'p2', object: 'o2', graph: 'g2' },
          { subject: 's2', predicate: 'p4', object: 'o3', graph: 'g3' },
          { subject: 's2', predicate: 'p4', object: 'o4', graph: 'g4' },
          { subject: 's2', predicate: 'p5', object: 'o3', graph: 'g5' },
          { subject: 's2', predicate: 'p6', object: 'o6', graph: 'g6' },
          { subject: 's2', predicate: 'p7', object: 'o7', graph: 'g7' },
        ];
        qs.put(quads)
          .then(() => {
            return qs.query({ subject: 's2' })
              .filter(quad => quad.predicate === 'p4')
              .toArray();
          })
          .then((foundQuads) => {
            should(foundQuads).have.length(2);
            should(foundQuads[0]).deepEqual(quads[3]);
            should(foundQuads[1]).deepEqual(quads[4]);
          });
      });
    });

    describe('QuadStore.prototype.query().join()', () => {

      it('Should query correctly.', () => {
        const quads = [
          { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0' },
          { subject: 's1', predicate: 'p1', object: 'o1', graph: 'g1' },
          { subject: 's2', predicate: 'p2', object: 'o2', graph: 'g2' },
          { subject: 's3', predicate: 'p4', object: 'o5', graph: 'g3' },
          { subject: 's3', predicate: 'p4', object: 'o4', graph: 'g4' },
          { subject: 's3', predicate: 'p5', object: 'o3', graph: 'g5' },
          { subject: 's6', predicate: 'p6', object: 'o6', graph: 'g5' },
          { subject: 's7', predicate: 'p7', object: 'o7', graph: 'g7' },
        ];
        qs.put(quads)
          .then(() => {
            return qs.query({ subject: 's3' })
              .join(qs.query({ graph: 'g5' }), ['context'])
              .toArray();
          })
          .then((foundQuads) => {
            should(foundQuads).have.length(1);
            should(foundQuads[0]).deepEqual(quads[5]);
          });
      });

    });

    describe('QuadStore.prototype.query() - Combined queries', () => {
      it('Should query, union, and join correctly', () => {
        const initialQuads = [
          { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0' },
          { subject: 's0', predicate: 'p1', object: 'o1', graph: 'g1' },
          { subject: 's0', predicate: 'p2', object: 'o6', graph: 'g2' },
          { subject: 's3', predicate: 'p3', object: 'o3', graph: 'g3' },
          { subject: 's4', predicate: 'p5', object: 'o4', graph: 'g4' },
          { subject: 's5', predicate: 'p5', object: 'o5', graph: 'g5' },
          { subject: 's6', predicate: 'p5', object: 'o6', graph: 'g6' }
        ];
        const filter = ((quad) => quad.predicate === 'p1');
        const queryTerms = { subject: 's0' };
        const unionTerms = { predicate: 'p5' };
        const joinTerms = { object: 'o6' };
        const expectedQuads = [initialQuads[2], initialQuads[6]]
          .sort(utils.quadSorter);
        return qs.put(initialQuads)
          .then(() => {
            return qs.query(queryTerms)
              .union(qs.query(unionTerms))
              .join(qs.query(joinTerms), ['object'])
              .toArray();
          })
          .then((foundQuads) => {
            foundQuads.sort(utils.quadSorter);
            should(foundQuads).have.length(2);
            should(foundQuads).deepEqual(expectedQuads);
          });
      });

      it('Should join (single, subject), join (single, predicate), and join (single, object) correctly', () => {
        const initialQuads = [
          { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0' },
          { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g1' },
          { subject: 's0', predicate: 'p0', object: 'o6', graph: 'g2' },
          { subject: 's0', predicate: 'p3', object: 'o3', graph: 'g3' },
          { subject: 's0', predicate: 'p5', object: 'o4', graph: 'g4' },
          { subject: 's5', predicate: 'p5', object: 'o5', graph: 'g5' },
          { subject: 's6', predicate: 'p5', object: 'o6', graph: 'g6' }
        ];
        const queryTerms = {};
        const firstJoinTerms = { subject: 's0' };
        const secondJoinTerms = { predicate: 'p0' };
        const thirdJoinTerms = { object: 'o0' };
        const expectedQuads = initialQuads.slice(0, 2)
          .sort(utils.quadSorter);
        return qs.put(initialQuads)
          .then(() => {
            return qs.query(queryTerms)
              .join(qs.query(firstJoinTerms), ['subject'])
              .join(qs.query(secondJoinTerms), ['predicate'])
              .join(qs.query(thirdJoinTerms), ['object'])
              .toArray();
          })
          .then((foundQuads) => {
            foundQuads.sort(utils.quadSorter);
            should(foundQuads).have.length(2);
            should(foundQuads).deepEqual(expectedQuads);
          });
      });

    });

  });

};
