
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { ClassicLevel } from 'classic-level';
import { DataFactory } from 'rdf-data-factory';
import { uid } from '../../dist/esm/utils/uid';
import { runQuadstoreTests } from '../quadstore/quadstore';

export const runClassicLevelTests = () => {

  describe('ClassicLevel backend', () => {

    beforeEach(async function () {
      this.location = path.join(os.tmpdir(), `quadstore-${uid()}`);
      this.db = new ClassicLevel(this.location);
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
