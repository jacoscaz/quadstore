
'use strict';

const os = require('os');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const utils = require('../dist/lib/utils');
const memdown = require('memdown');
const leveldown = require('leveldown');
const rdfSuite = require('./rdf');
const searchSuite = require('./search');
const rdfStoreSuite = require('./rdfstore');
const quadStoreSuite = require('./quadstore');
const serialization = require('./serialization');

const remove = util.promisify(fs.remove);

rdfSuite();
searchSuite();
serialization();

describe('MemDOWN backend, standard indexes', () => {

  beforeEach(async function () {
    this.db = memdown();
    this.indexes = null;
  });

  quadStoreSuite();
  rdfStoreSuite();

});

describe('MemDOWN backend, standard indexes, prefixes', () => {

  beforeEach(async function () {
    this.db = memdown();
    this.indexes = null;
    this.prefixes = {
      expandTerm: term => term.replace(/^ex:/, 'http://ex.com/'),
      compactIri: iri => iri.replace(/^http:\/\/ex\.com\//, 'ex:')
    };
  });

  rdfStoreSuite();

});

describe('LevelDOWN backend, standard indexes', () => {

  beforeEach(async function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + utils.nanoid());
    this.db = leveldown(this.location);
    this.indexes = null;
  });

  afterEach(async function () {
    await remove(this.location);
  });

  quadStoreSuite();
  rdfStoreSuite();

});
