
import type { Prefixes } from '../../dist/esm/types';
import { Quadstore } from '../../dist/esm/quadstore';
import { runSerializationTests } from './serialization';
import { runPrewriteTests } from './prewrite';
import { runGetTests } from './get';
import { runDelTests } from './del';
import { runRemoveTests } from './remove';
import { runImportTests } from './import';
import { runRemoveMatchesTests } from './removematches';
import { runPatchTests } from './patch';
import { runMatchTests } from './match';
import { runScopeTests } from './scope';
import { runPutTests } from './put';
import { runRangeTests } from './ranges';

const runTests = () => {
  runGetTests();
  runDelTests();
  runPutTests();
  runScopeTests();
  runPatchTests();
  runMatchTests();
  runRangeTests();
  runImportTests();
  runRemoveTests();
  runRemoveMatchesTests();
  runPrewriteTests();
  runSerializationTests();
};

export const runQuadstoreTests = () => {

  describe('Constructor', () => {
    it('should throw if backend is not an instance of AbstractLevel', function (done) {
      try {
        new Quadstore({
          dataFactory: (this.dataFactory as any),
          backend: (5 as any),
        });
      } catch (err) {
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

    const prefixes: Prefixes = {
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
