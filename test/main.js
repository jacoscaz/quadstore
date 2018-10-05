
'use strict';

const os = require('os');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const nanoid = require('nanoid');
const memdown = require('memdown');
const leveldown = require('leveldown');
const rdfStoreSuite = require('./rdfstore');
const quadStoreSuite = require('./quadstore');

const remove = util.promisify(fs.remove);

describe('MemDOWN backend', () => {

  beforeEach(async function () {
    this.db = memdown();
  });

  quadStoreSuite();
  rdfStoreSuite();

});

describe('LevelDOWN backend', () => {

  beforeEach(async function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + nanoid());
    this.db = leveldown(this.location);
  });

  afterEach(async function () {
    await remove(this.location);
  });

  quadStoreSuite();
  rdfStoreSuite();

});
