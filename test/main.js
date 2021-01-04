
'use strict';

const os = require('os');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const utils = require('../dist/lib/utils');
const rocksdb = require('rocksdb');
const memdown = require('memdown');
const leveldown = require('leveldown');
const {DataFactory} = require('rdf-data-factory');

const remove = util.promisify(fs.remove);

require('./fpstring')();

describe('MemDOWN backend', () => {

  beforeEach(async function () {
    this.db = memdown();
    this.indexes = null;
    this.dataFactory = new DataFactory();
  });

  require('./quadstore')();

});

describe('LevelDOWN backend', () => {

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

describe('RocksDB backend', () => {

  beforeEach(async function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + utils.nanoid());
    this.db = rocksdb(this.location);
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
      expandTerm: (term) => {
        if (term.startsWith('xsd:')) {
          return `http://www.w3.org/2001/XMLSchema#${term.slice(4)}`;
        }
        if (term.startsWith('rdf:')) {
          return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${term.slice(4)}`;
        }
        if (term.startsWith('e:')) {
          return `ex://${term.slice(2)}`;
        }
        return term;
      },
      compactIri: (iri) => {
        if (iri.startsWith('http://www.w3.org/2001/XMLSchema#')) {
          return `xsd:${iri.slice(33)}`;
        }
        if (iri.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#')) {
          return `rdf:${iri.slice(43)}`;
        }
        if (iri.startsWith('ex://')) {
          return `e:${iri.slice(5)}`;
        }
        return iri;
      },
    };
  });

  require('./quadstore')();

});
