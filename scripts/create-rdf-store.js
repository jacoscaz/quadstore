
'use strict';

const os = require('os');
const path = require('path');
const shortid = require('shortid');
const memdown = require('memdown');
const factory = require('rdf-data-model');
const RdfStore = require('..').RdfStore;

(async () => {

  const store = new RdfStore(shortid.generate(), {
    db: memdown,
    dataFactory: factory
  });

  for (let i = 0; i < 200; i += 1) {
    await store.put(factory.quad(
      factory.namedNode(`ex://s${i}`),
      factory.namedNode(`ex://p${i}`),
      factory.namedNode(`ex://o${i}`),
      factory.namedNode(`ex://g${i}`)
    ));
  }

  process.on('SIGINT', () => {
    store.close((err) => {
      if (err) throw err;
      process.exit();
    });
  });

})();
