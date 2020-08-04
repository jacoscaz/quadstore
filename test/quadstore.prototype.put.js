
const should = require('./should');

module.exports = () => {

  describe('QuadStore.prototype.put()', () => {

    it('should store a single quad', async function () {
      const store = this.store;
      const newQuad = {subject: 's', predicate: 'p', object: 'o', graph: 'c'};
      await store.put(newQuad);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray([newQuad], store);
    });

    it('should store multiple quads', async function () {
      const store = this.store;
      const newQuads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'},
      ];
      await store.put(newQuads[0]);
      await store.put(newQuads[1]);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray(newQuads, store);
    });

    it('should not duplicate quads', async function () {
      const store = this.store;
      const newQuads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'},
      ];
      await store.put(newQuads[0]);
      await store.put(newQuads[1]);
      await store.put(newQuads[1]);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray(newQuads, store);
    });

  });

};
