import { Quadstore } from '../../dist/esm/quadstore.js';
import { runSerializationTests } from './serialization.js';
import { runPrewriteTests } from './prewrite.js';
import { runGetTests } from './get.js';
import { runDelTests } from './del.js';
import { runRemoveTests } from './remove.js';
import { runImportTests } from './import.js';
import { runRemoveMatchesTests } from './removematches.js';
import { runPatchTests } from './patch.js';
import { runMatchTests } from './match.js';
import { runScopeTests } from './scope.js';
import { runPutTests } from './put.js';
const runTests = () => {
    runGetTests();
    runDelTests();
    runPutTests();
    runScopeTests();
    runPatchTests();
    runMatchTests();
    runImportTests();
    runRemoveTests();
    runRemoveMatchesTests();
    runPrewriteTests();
    runSerializationTests();
    // require('./quadstore.prototype.put')();
    // require('./quadstore.scope')();
};
export const runQuadstoreTests = () => {
    describe('Constructor', () => {
        it('should throw if backend is not an instance of AbstractLevel', function (done) {
            try {
                new Quadstore({
                    dataFactory: this.dataFactory,
                    backend: 5,
                });
            }
            catch (err) {
                done();
            }
        });
    });
    describe('Quadstore', () => {
        beforeEach(async function () {
            this.store = new Quadstore({
                dataFactory: this.dataFactory,
                backend: this.db,
                indexes: this.indexes,
                prefixes: this.prefixes,
            });
            await this.store.open();
        });
        afterEach(async function () {
            await this.store.close();
        });
        runTests();
    });
    describe('Quadstore, with prefixes', () => {
        const prefixes = {
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
        beforeEach(async function () {
            this.store = new Quadstore({
                dataFactory: this.dataFactory,
                backend: this.db,
                indexes: this.indexes,
                prefixes: this.prefixes,
            });
            await this.store.open();
        });
        afterEach(async function () {
            await this.store.close();
        });
        runTests();
    });
};
