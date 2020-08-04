
const should = require('./should');

module.exports = () => {

  describe('QuadStore.prototype.multiPut()', () => {

    it('should store multiple quads', async function () {
      const store = this.store;
      const newQuads = [
        {subject: 's0', predicate: 'p0', object: 'o0', graph: 'c0'},
        {subject: 's1', predicate: 'p1', object: 'o1', graph: 'c1'}
      ];
      await store.multiPut(newQuads);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray(newQuads, store);
    });

    it('should not duplicate quads', async function () {
      const store = this.store;
      const newQuads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'}
      ];
      await store.multiPut([...newQuads, ...newQuads]);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray(newQuads, store);
    });

  });

};

