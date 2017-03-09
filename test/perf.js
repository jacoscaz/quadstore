
'use strict';

const _ = require('lodash');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const shortid = require('shortid');
const QuadStore = require('../lib/quadstore.js');

const db = path.join(os.tmpdir(), 'quadstore-' + shortid.generate());

async.series(
  [
    function (cb) {
      fs.ensureDir(db, cb);
    },
    function (cb) {
      const qs = new QuadStore({ db });
      const now = Date.now();
      const qty = 100000;
      async.timesSeries(
        qty,
        function (n, next) {
          qs.put({ subject: 's' + n, predicate: 'p' + n, object: 'o' + n, context: 'c' + n }, next);
        },
        function (err) {
          if (err) { cb(err); return; }
          const then = Date.now();
          const delta = (then - now) / 1000;
          console.log('PUT %s: %s s (%s op/s)', qty, delta, qty / delta);
          cb();
        }
      );
    },
    function (cb) {
      fs.remove(db, cb);
    }
  ],
  function (err) {
    if (err) throw err;
  }
);
