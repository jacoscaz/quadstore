
const should = require('should');
const { streamToArray } = require('../dist/cjs/utils/stuff');
const { Scope } = require('../dist/cjs/scope');
const { LevelIterator } = require('../dist/cjs/get/leveliterator');

module.exports = () => {

  describe('Quadstore.prototype.initScope()', () => {

    it('Should return a newly-instantiated scope', async function () {
      const {dataFactory, store} = this;
      const scope = await store.initScope();
      should(scope).be.instanceof(Scope);
    });

  });

  describe('Quadstore.prototype.loadScope()', () => {

    it('Should return a newly-instantiated scope', async function () {
      const {dataFactory, store} = this;
      const scope = await store.loadScope('random-id');
      should(scope).be.instanceof(Scope);
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
      should(items).have.length(2);
      const reloadedScopeA = await store.loadScope(scopeA.id);
      const reloadedScopeB = await store.loadScope(scopeB.id);
      should(reloadedScopeA.blankNodes.get('bo')).not.equal(reloadedScopeB.blankNodes.get('bo'));
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
        (key, value) => value.toString('utf8'),
      ));
      const entriesB = await streamToArray(new LevelIterator(
        store.db.iterator(Scope.getLevelIteratorOpts(true, true, scopeB.id)),
        (key, value) => value.toString('utf8'),
      ));
      should(entriesA).be.an.Array();
      should(entriesB).be.an.Array();
      should(entriesA).have.length(0);
      should(entriesB).have.length(1);
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
        (key, value) => value.toString('utf8'),
      ));
      should(entries).be.an.Array();
      should(entries).have.length(0);
    });

  });



};
