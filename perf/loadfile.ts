
'use strict';


import fs from 'fs-extra';
import os from 'os'
import path from 'path';
import util from 'util';
import * as utils from '../lib/utils';
import { RdfStore } from '../lib/rdfstore';
import leveldown from 'leveldown';
import { DataFactory, StreamParser } from 'n3';
import childProcess from 'child_process';

const du = (absPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    childProcess.exec(`du -sm ${absPath}`, (err: Error|null, stdout: string) => {
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

  await new Promise((resolve) => setTimeout(resolve, 1000));

  debugger;

  const store = new RdfStore({
    backend: leveldown(absStorePath),
    dataFactory: DataFactory,
  });

  await utils.waitForEvent(store, 'ready');

  const absFilePath = path.resolve(process.cwd(), filePath);

  const fileReader = fs.createReadStream(absFilePath);
  const streamParser = new StreamParser({ format });

  const beforeTime = Date.now();
  await store.putStream(fileReader.pipe(streamParser));
  // await store.putStream(fileReader.pipe(streamParser), { batchSize: 1000 });
  const afterTime = Date.now();

  await store.close();

  const diskUsage = await du(absStorePath);

  console.log(`TIME: ${(afterTime - beforeTime) / 1000} s`);
  console.log(`DISK: ${diskUsage}`);

  await remove(absStorePath);

})();
