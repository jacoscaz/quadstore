
'use strict';

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const shortid = require('shortid');
const memdown = require('memdown');
const levelup = require('levelup');
const Promise = require('bluebird');
const QuadStore = require('..').QuadStore;
const leveldown = require('leveldown');
const rdfStoreSuite = require('./rdfstore');
const quadStoreSuite = require('./quadstore');

const remove = Promise.promisify(fs.remove, { context: fs });

describe('MemDOWN backend', () => {

  beforeEach(async function () {
    this.location = shortid();
    this.db = levelup(this.location, { valueEncoding: QuadStore.valueEncoding, db: memdown });
  });

  quadStoreSuite();
  rdfStoreSuite();

});

describe('LevelDOWN backend', () => {

  beforeEach(async function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
    this.db = levelup(this.location, { valueEncoding: QuadStore.valueEncoding, db: leveldown });
  });

  afterEach(async function () {
    await remove(this.location);
  });

  quadStoreSuite();
  rdfStoreSuite();

});
