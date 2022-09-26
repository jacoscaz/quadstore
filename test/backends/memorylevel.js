import { MemoryLevel } from 'memory-level';
import { DataFactory } from 'rdf-data-factory';
import { runQuadstoreTests } from '../quadstore/quadstore.js';
export const runMemoryLevelTests = () => {
    describe('MemoryLevel backend', () => {
        beforeEach(async function () {
            this.db = new MemoryLevel();
            this.indexes = null;
            this.dataFactory = new DataFactory();
            this.prefixes = {
                expandTerm: (term) => term,
                compactIri: (iri) => iri,
            };
        });
        runQuadstoreTests();
    });
};
