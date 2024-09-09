
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { DataFactory } from 'rdf-data-factory';
import { runQuadstoreTests } from '../quadstore/quadstore.js';
import { uid } from '../../dist/esm/utils/uid.js';

export const runRocksLevelNXTEditionTests = () => {

  describe('RocksLevel (NXTEdition) backend', () => {

    beforeEach(async function () {

      // @ts-ignore
      const { RocksLevel } = await import('@nxtedition/rocksdb');

      this.location = path.join(os.tmpdir(), `quadstore-${uid()}`);
      this.db = new RocksLevel(this.location);
      this.indexes = null;
      this.dataFactory = new DataFactory();
      this.prefixes = {
        expandTerm: (term: string) => term,
        compactIri: (iri: string) => iri,
      };
    });

    afterEach(async function () {
      await fs.rm(this.location, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    });

    runQuadstoreTests();

  });

};
