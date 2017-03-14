
'use strict';

const utils = require('../lib/utils');
const should = require('should');
const shortid = require('shortid');
const memdown = require('memdown');
const QuadStore = require('..').QuadStore;

describe('QuadStore', () => {

  let qs;

  beforeEach(() => {
    qs = new QuadStore(shortid.generate(), { db: memdown });
  });

  describe('QuadStore.prototype.put()', () => {

    it('should store a single quad correctly (as object)', (done) => {
      const newQuad = { subject: 's', predicate: 'p', object: 'o', context: 'c' };
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

    it('should store a single quad correctly (as array)', (done) => {
      const newQuads = [{ subject: 's', predicate: 'p', object: 'o', context: 'c' }];
      qs.put(newQuads, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({}, (err, foundQuads) => {
          if (err) { done(err); return; }
          should(foundQuads).have.length(1);
          should(foundQuads[0]).deepEqual(newQuads[0]);
          done();
        });
      });
    });

    it('should store multiple quads correctly', (done) => {
      const newQuads = [
        { subject: 's0', predicate: 'p0', object: 'o0', context: 'c0' },
        { subject: 's1', predicate: 'p1', object: 'o1', context: 'c1' }
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

    it('should not duplicate quads', (done) => {
      const newQuads = [
        { subject: 's', predicate: 'p', object: 'o', context: 'c' },
        { subject: 's', predicate: 'p', object: 'o', context: 'c' }
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

  });

  describe('QuadStore.prototype.del()', () => {

    it('should delete a quad correctly', (done) => {
      const quad = { subject: 's', predicate: 'p', object: 'o', context: 'c' };
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

  });

  describe('QuadStore.prototype.getputdel()', () => {

    const quadsSamples = [
      { subject: 's', predicate: 'p', object: 'o', context: 'c' },
      { subject: 's', predicate: 'p2', object: 'o2', context: 'c2' },
      { subject: 's2', predicate: 'p', object: 'o', context: 'c' },
      { subject: 's2', predicate: 'p', object: 'o2', context: 'c' },
      { subject: 's2', predicate: 'p2', object: 'o2', context: 'c2' },
    ];

    it('should delete matching quads and do an insert', (done) => {
      const quadsArray = quadsSamples;
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', context: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', context: 'c1' },
      ];
      qs.put(quadsArray, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.getdelput({}, newQuads, (err) => {
          if (err) { done(err); return; }
          qs.get({}, (getErr, quads) => {
            if (getErr) { done(getErr); return; }
            newQuads.sort(utils.quadSorter);
            quads.sort(utils.quadSorter);
            should(quads).have.length(2);
            should(quads).be.deepEqual(newQuads);
            done();
          });
        });
      });
    });

  });

  describe('QuadStore.prototype.get()', () => {

    const quadsSamples = [
      { subject: 's', predicate: 'p', object: 'o', context: 'c' },
      { subject: 's', predicate: 'p2', object: 'o2', context: 'c2' },
      { subject: 's2', predicate: 'p', object: 'o', context: 'c' },
      { subject: 's2', predicate: 'p', object: 'o2', context: 'c' },
      { subject: 's2', predicate: 'p2', object: 'o2', context: 'c2' },
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
        qs.get({ context: 'c' }, (getErr, quads) => {
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
        qs.get({ subject: 's2', context: 'c' }, (getErr, quads) => {
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
        qs.get({ predicate: 'p', context: 'c' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(3);
          done();
        });
      });
    });

    it('should match quads by object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ object: 'o2', context: 'c2' }, (getErr, quads) => {
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
        qs.get({ subject: 's', predicate: 'p2', context: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          done();
        });
      });
    });

    it('should match quads by subject, object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's', object: 'o2', context: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          done();
        });
      });
    });

    it('should match quads by predicate, object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ predicate: 'p2', object: 'o2', context: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(2);
          done();
        });
      });
    });

    it('should match quads by subject, predicate, object and context', (done) => {
      qs.put(quadsSamples, (putErr) => {
        if (putErr) { done(putErr); return; }
        qs.get({ subject: 's2', predicate: 'p2', object: 'o2', context: 'c2' }, (getErr, quads) => {
          if (getErr) { done(getErr); return; }
          should(quads).have.length(1);
          should(quads[0]).deepEqual(quadsSamples[4]);
          done();
        });
      });
    });

  });

});
