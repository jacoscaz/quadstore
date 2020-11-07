
const should = require('./should');

module.exports = () => {

  describe('QuadStore.prototype.put()', () => {

    it('should store a single quad', async function () {
      const { dataFactory, store } = this;
      const newQuad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.namedNode('ex://o'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(newQuad);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray([newQuad], store);
    });

    it('should store multiple quads', async function () {
      const { dataFactory, store } = this;
      const newQuads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
      ];
      await store.put(newQuads[0]);
      await store.put(newQuads[1]);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray(newQuads, store);
    });

    it('should not duplicate quads', async function () {
      const { dataFactory, store } = this;
      const newQuads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
      ];
      await store.put(newQuads[0]);
      await store.put(newQuads[1]);
      await store.put(newQuads[1]);
      const {items: foundQuads} = await store.get({});
      should(foundQuads).be.equalToQuadArray(newQuads, store);
    });

  });

};
