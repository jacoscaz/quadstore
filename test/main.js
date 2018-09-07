
'use strict';

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const shortid = require('shortid');
const memdown = require('memdown');
const Promise = require('bluebird');
const leveldown = require('leveldown');
const rdfStoreSuite = require('./rdfstore');
const quadStoreSuite = require('./quadstore');

const remove = Promise.promisify(fs.remove, { context: fs });

describe('MemDOWN backend', () => {

  beforeEach(async function () {
    this.db = memdown();
  });

  quadStoreSuite();
  rdfStoreSuite();

});

describe('LevelDOWN backend', () => {

  beforeEach(async function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
    this.db = leveldown(this.location);
  });

  afterEach(async function () {
    await remove(this.location);
  });

  quadStoreSuite();
  rdfStoreSuite();

});
