
import { equalsQuadArray } from '../utils/expect.js';

export const runDelTests = () => {

  describe('Quadstore.prototype.del()', () => {

    it('should delete a quad correctly', async function () {
      const { dataFactory, store } = this;
      const quads = [
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
      ]
      await store.multiPut(quads);
      const { items: quadsBefore } = await store.get({});
      equalsQuadArray(quadsBefore, quads);
      await store.del(quadsBefore[0]);
      const { items: quadsAfter } = await store.get({});
      equalsQuadArray(quadsAfter, [quads[1]]);
    });

  });

  describe('Quadstore.prototype.multiDel()', () => {

    it('should delete a quad correctly', async function () {
      const { dataFactory, store } = this;
      const quads = [
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
      ]
      await store.multiPut(quads);
      const { items: quadsBefore } = await store.get({});
      equalsQuadArray(quadsBefore, quads);
      await store.multiDel([quadsBefore[0]]);
      const { items: quadsAfter } = await store.get({});
      equalsQuadArray(quadsAfter, [quads[1]]);
    });

  });

};
