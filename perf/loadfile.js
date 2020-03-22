
'use strict';

const n3 = require('n3');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const util = require('util');
const utils = require('../lib/utils');
const RdfStore = require('..').RdfStore;
const leveldown = require('leveldown');
const dataFactory = require('n3').DataFactory;
const childProcess = require('child_process');

function du(absPath) {
  return new Promise((resolve, reject) => {
    childProcess.exec(`du -sm ${absPath}`, (err, stdout) => {
      if (err) reject(err);
      else resolve(`${stdout.split(/\s+/)[0]} MB`);
    });
  });
}

const remove = util.promisify(fs.remove.bind(fs));

(async () => {

  const args = process.argv.slice(2);

  const filePath = args[0];
  const format = args[1] || 'text/turtle';

  if (!filePath) {
    console.log('\n\n  USAGE: node loadfile.js <filePath> [mimeType]\n\n');
    return;
  }

  const absStorePath = path.join(os.tmpdir(), `node-quadstore-${utils.nanoid()}`);
  console.log(absStorePath);

  const store = new RdfStore(leveldown(absStorePath), { dataFactory });

  await utils.waitForEvent(store, 'ready');

  const absFilePath = path.resolve(process.cwd(), filePath);

  const fileReader = fs.createReadStream(absFilePath);
  const streamParser = new n3.StreamParser({ format });

  const beforeTime = Date.now();
  await store.putStream(fileReader.pipe(streamParser));
  const afterTime = Date.now();

  await store.close();

  const diskUsage = await du(absStorePath);

  console.log(`TIME: ${(afterTime - beforeTime) / 1000} s`);
  console.log(`DISK: ${diskUsage}`);

  await remove(absStorePath);

})();
