
'use strict';

const os = require('os');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const utils = require('../dist/lib/utils');
const memdown = require('memdown');
const leveldown = require('leveldown');
const {DataFactory} = require('rdf-data-factory');

const remove = util.promisify(fs.remove);

require('./fpstring')();

describe('MemDOWN backend, standard indexes', () => {

  beforeEach(async function () {
    this.db = memdown();
    this.indexes = null;
    this.dataFactory = new DataFactory();
  });

  require('./quadstore')();

});

describe('LevelDOWN backend, standard indexes', () => {

  beforeEach(async function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + utils.nanoid());
    this.db = leveldown(this.location);
    this.indexes = null;
    this.dataFactory = new DataFactory();
  });

  afterEach(async function () {
    await remove(this.location);
  });

  require('./quadstore')();

});

describe('MemDOWN backend, standard indexes, with prefixes', () => {

  beforeEach(async function () {
    this.db = memdown();
    this.indexes = null;
    this.dataFactory = new DataFactory();
    this.prefixes = {
      expandTerm: term => term.replace(/^exprefix:/, 'ex://'),
      compactIri: iri => iri.replace(/^ex:\/\//, 'exprefix:'),
    };
  });

  require('./quadstore')();

});
