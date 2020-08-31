
import fs from 'fs-extra';
import path from 'path';
import * as utils from '../lib/utils';
import { RdfStore } from '../lib/rdfstore';
import { DataFactory, StreamParser } from 'n3';
import {disk, time} from './utils';
import {AbstractLevelDOWN} from 'abstract-leveldown';

(async () => {

  const args = process.argv.slice(2);

  const filePath = args[0];
  const format = args[1] || 'text/turtle';

  if (!filePath) {
    console.log('\n\n  USAGE: node loadfile.js <filePath> [mimeType]\n\n');
    return;
  }

  await disk(async (backend: AbstractLevelDOWN, checkDiskUsage) => {

    await new Promise((resolve) => setTimeout(resolve, 1000));

    debugger;

    const store = new RdfStore({
      backend,
      dataFactory: DataFactory,
    });

    await utils.waitForEvent(store, 'ready');

    const absFilePath = path.resolve(process.cwd(), filePath);

    const fileReader = fs.createReadStream(absFilePath);
    const streamParser = new StreamParser({ format });

    const { time: putTime } = await time(() => store.putStream(fileReader.pipe(streamParser)));
    // const { time: putTime } = await time(() => store.putStream(fileReader.pipe(streamParser), { batchSize: 1000 }));

    const diskUsage = await checkDiskUsage();

    console.log(`TIME: ${putTime} s`);
    console.log(`DISK: ${diskUsage}`);

  });

})();
