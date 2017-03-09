
'use strict';

const _ = require('lodash');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');
const should = require('should');
const shortid = require('shortid');
const QuadStore = require('..').QuadStore;

let db;
let qs;

beforeEach((done) => {
  db = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
  fs.ensureDir(db, (err) => {
    if (err) { done(err); return; }
    qs = new QuadStore(db);
    done();
  });
});

afterEach((done) => {
  fs.remove(db, done);
});

describe('QuadStore', () => {

  const quadsSamples = [
    { subject: 's', predicate: 'p', object: 'o', context: 'c' },
    { subject: 's', predicate: 'p2', object: 'o2', context: 'c2' },
    { subject: 's2', predicate: 'p', object: 'o', context: 'c' },
    { subject: 's2', predicate: 'p', object: 'o2', context: 'c' },
    { subject: 's2', predicate: 'p2', object: 'o2', context: 'c2' },
  ];

  it('should store a quad correctly', (done) => {
    const quad = { subject: 's', predicate: 'p', object: 'o', context: 'c' };
    qs.put(quad, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({}, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        should(quads[0]).deepEqual(quad);
        done();
      });
    });
  });

  it('should not duplicate quads', (done) => {
    const quad = { subject: 's', predicate: 'p', object: 'o', context: 'c' };
    qs.put([quad, quad], (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({}, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        should(quads[0]).deepEqual(quad);
        done();
      });
    });
  });

  it('should delete a quad correctly', (done) => {
    const quad = { subject: 's', predicate: 'p', object: 'o', context: 'c' };
    qs.put(quad, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({}, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        qs.del(quads[0], (delErr) => {
          if (delErr) { done(delErr); return; }
          qs.match({}, (getErr, quadsAfterDelete) => {
            if (getErr) { done(getErr); return; }
            should(quadsAfterDelete).have.length(0);
            done();
          });
        });
      });
    });
  });

  it('should store an array of quads correctly', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({}, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        quads.sort(utils.quadSorter);
        should(quads).have.length(5);
        should(quads).deepEqual(quadsArray);
        done();
      });
    });
  });

  it('should match quads by subject', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);
        done();
      });
    });
  });

  it('should match quads by predicate', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ predicate: 'p' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(3);
        done();
      });
    });
  });

  it('should match quads by object', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ object: 'o' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);
        done();
      });
    });
  });

  it('should match quads by context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ context: 'c' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(3);
        done();
      });
    });
  });

  it('should match quads by subject and predicate', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's2', predicate: 'p' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);
        done();
      });
    });
  });

  it('should match quads by subject and object', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's2', object: 'o' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        done();
      });
    });
  });

  it('should match quads by subject and context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's2', context: 'c' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);
        done();
      });
    });
  });

  it('should match quads by predicate and object', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ predicate: 'p', object: 'o' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);
        done();
      });
    });
  });

  it('should match quads by predicate and context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ predicate: 'p', context: 'c' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(3);
        done();
      });
    });
  });

  it('should match quads by object and context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ object: 'o2', context: 'c2' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);

        done();
      });
    });
  });

  it('should match quads by subject, predicate and object', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's', predicate: 'p2', object: 'o2' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        done();
      });
    });
  });

  it('should match quads by subject, predicate and context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's', predicate: 'p2', context: 'c2' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        done();
      });
    });
  });

  it('should match quads by subject, object and context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's', object: 'o2', context: 'c2' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        done();
      });
    });
  });

  it('should get quads by predicate, object and context', (done) => {
    const quadsArray = quadsSamples;
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ predicate: 'p2', object: 'o2', context: 'c2' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(2);
        done();
      });
    });
  });

  it('should match quads by subject, predicate, object and context', (done) => {
    qs.put(quadsSamples, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.match({ subject: 's2', predicate: 'p2', object: 'o2', context: 'c2' }, (getErr, quads) => {
        if (getErr) { done(getErr); return; }
        should(quads).have.length(1);
        should(quads[0]).deepEqual(quadsSamples[4]);
        done();
      });
    });
  });


  it('should delete matched quads, and do an insert', (done) => {
    const quadsArray = quadsSamples;
    const newQuads = [
      { subject: 's3', predicate: 'p3', object: 'o2', context: 'c' },
      { subject: 's4', predicate: 'p3', object: 'o2', context: 'c1' },
    ];
    qs.put(quadsArray, (putErr) => {
      if (putErr) { done(putErr); return; }
      qs.matchDeleteAndInsert({}, newQuads, (err) => {
        if (err) { done(err); return; }
        qs.match({}, (getErr, quads) => {
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
