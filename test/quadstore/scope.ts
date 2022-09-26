

import { streamToArray } from '../../dist/esm/utils/stuff';
import { Scope } from '../../dist/esm/scope';
import { LevelIterator } from '../../dist/esm/get/leveliterator';
import { arrayToHaveLength, toNotEqualTerm, toBeAnArray, toBeInstanceOf } from '../utils/expect.js';

export const runScopeTests = () => {

  describe('Quadstore.prototype.initScope()', () => {

    it('Should return a newly-instantiated scope', async function () {
      const { store } = this;
      const scope = await store.initScope();
      toBeInstanceOf(scope, Scope);
    });

  });

  describe('Quadstore.prototype.loadScope()', () => {

    it('Should return a newly-instantiated scope', async function () {
      const { store } = this;
      const scope = await store.loadScope('random-id');
      toBeInstanceOf(scope, Scope);
    });

    it('Should not leak mappings between different scopes', async function () {
      const {dataFactory, store} = this;
      const scopeA = await store.initScope();
      const scopeB = await store.initScope();
      const quad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(quad, { scope: scopeA });
      await store.put(quad, { scope: scopeB });
      const { items } = await store.get({});
      arrayToHaveLength(items, 2);
      const reloadedScopeA = await store.loadScope(scopeA.id);
      const reloadedScopeB = await store.loadScope(scopeB.id);
      toNotEqualTerm(reloadedScopeA.blankNodes.get('bo'), reloadedScopeB.blankNodes.get('bo'));
    });

  });

  describe('Quadstore.prototype.deleteScope()', () => {

    it('Should delete the mappings of a given scope', async function () {
      const {dataFactory, store} = this;
      const scopeA = await store.initScope();
      const scopeB = await store.initScope();
      const quad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(quad, { scope: scopeA });
      await store.put(quad, { scope: scopeB });
      await store.deleteScope(scopeA.id);
      const entriesA = await streamToArray(new LevelIterator(
        store.db.iterator(Scope.getLevelIteratorOpts(true, true, scopeA.id)),
        (key: string, value: string) => value,
      ));
      const entriesB = await streamToArray(new LevelIterator(
        store.db.iterator(Scope.getLevelIteratorOpts(true, true, scopeB.id)),
        (key: string, value: string) => value,
      ));
      toBeAnArray(entriesA);
      toBeAnArray(entriesB);
      arrayToHaveLength(entriesA, 0);
      arrayToHaveLength(entriesB, 1);
    });

  });

  describe('Quadstore.prototype.deleteAllScopes()', () => {

    it('Should delete all scope mappings', async function () {
      const {dataFactory, store} = this;
      const scopeA = await store.initScope();
      const scopeB = await store.initScope();
      const quad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(quad, { scope: scopeA });
      await store.put(quad, { scope: scopeB });
      await store.deleteAllScopes();
      const entries = await streamToArray(new LevelIterator(
        store.db.iterator(Scope.getLevelIteratorOpts(true, true)),
        (key: string, value: string) => value,
      ));
      toBeAnArray(entries);
      arrayToHaveLength(entries, 0);
    });

  });



};
