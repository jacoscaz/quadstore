
'use strict';

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const shortid = require('shortid');
const memdown = require('memdown');
const levelup = require('levelup');
const factory = require('rdf-data-model');
const leveldown = require('leveldown');
const QuadStore = require('..').QuadStore;
const RdfStore = require('..').RdfStore;
const quadStoreSuite = require('./quadstore');
const rdfStoreSuite = require('./rdfstore');

describe('QuadStore / Auto / MemDOWN', () => {

  beforeEach(function () {
    this.store = new QuadStore(shortid.generate(), { db: memdown });
  });

  quadStoreSuite();

});

describe('RdfStore / Auto / MemDOWN', () => {

  beforeEach(function () {
    this.store = new RdfStore(shortid.generate(), { db: memdown, dataFactory: factory });
  });

  rdfStoreSuite();

});

describe('QuadStore / LevelUP / MemDOWN', () => {

  beforeEach(function () {
    this.location = shortid();
    this.db = levelup(this.location, { valueEncoding: QuadStore.valueEncoding, db: memdown });
    this.store = new QuadStore(this.db);
  });

  quadStoreSuite();

});

describe('RdfStore / LevelUP / MemDOWN', () => {

  beforeEach(function () {
    this.location = shortid();
    this.db = levelup(this.location, { valueEncoding: QuadStore.valueEncoding, db: memdown });
    this.store = new RdfStore(this.db, { dataFactory: factory });
  });

  rdfStoreSuite();

});

describe('QuadStore / LevelUP / LevelDOWN', () => {

  beforeEach(function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
    this.db = levelup(this.location, { valueEncoding: QuadStore.valueEncoding, db: leveldown });
    this.store = new QuadStore(this.db);
  });

  afterEach(function (done) {
    const context = this;
    context.store.close((closeErr) => {
      if (closeErr) { done(closeErr); return; }
      fs.remove(context.location, done);
    });
  });

  quadStoreSuite();

});

describe('RdfStore / LevelUP / LevelDOWN', () => {

  beforeEach(function () {
    this.location = path.join(os.tmpdir(), 'node-quadstore-' + shortid.generate());
    this.db = levelup(this.location, { valueEncoding: QuadStore.valueEncoding, db: leveldown });
    this.store = new RdfStore(this.db, { dataFactory: factory });
  });

  afterEach(function (done) {
    const context = this;
    context.store.close((closeErr) => {
      if (closeErr) { done(closeErr); return; }
      fs.remove(context.location, done);
    });
  });

  rdfStoreSuite();

});
