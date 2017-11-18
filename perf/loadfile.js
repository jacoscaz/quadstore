
'use strict';

const n3 = require('n3');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const memdown = require('memdown');
const Promise = require('bluebird');
const shortid = require('shortid');
const RdfStore = require('..').RdfStore;
const asynctools = require('asynctools');
const dataFactory = require('rdf-data-model');
const childProcess = require('child_process');

function du(absPath) {
  return new Promise((resolve, reject) => {
    childProcess.exec(`du -sm ${absPath}`, (err, stdout) => {
      if (err) reject(err);
      else resolve(`${stdout.split(/\s+/)[0]} MB`);
    });
  });
}

const remove = Promise.promisify(fs.remove, { context: 'fs' });

(async () => {

  const args = process.argv.slice(2);

  const filePath = args[0];
  const format = args[1] || 'text/turtle';

  if (!filePath) {
    console.log('\n\n  USAGE: node scripts/perf/loadfile.js <filePath>\n\n');
    return;
  }

  const absStorePath = path.join(os.tmpdir(), `node-quadstore-${shortid.generate()}`);

  const store = new RdfStore(absStorePath, { dataFactory });

  await asynctools.waitForEvent(store, 'ready', true);

  const absFilePath = path.resolve(process.cwd(), filePath);

  const fileReader = fs.createReadStream(absFilePath);
  const streamParser = n3.StreamParser({ format });
  const deserializer = store._createQuadDeserializerStream();

  const beforeTime = Date.now();
  await store.putStream(fileReader.pipe(streamParser).pipe(deserializer));
  const afterTime = Date.now();

  await store.close();

  const diskUsage = await du(absStorePath);

  console.log(`TIME: ${(afterTime - beforeTime) / 1000} s`);
  console.log(`DISK: ${diskUsage}`);

  await remove(absStorePath);

})();
