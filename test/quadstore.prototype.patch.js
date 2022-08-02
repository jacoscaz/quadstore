
'use strict';

const should = require('./should');

module.exports = () => {

  describe('Quadstore.prototype.patch()', async function () {

    it('should delete old quads and add new ones', async function () {
      const { dataFactory, store } = this;
      const quadsArray = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
      ];
      const oldQuads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
      ];
      const newQuads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s3'),
          dataFactory.namedNode('ex://p3'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s4'),
          dataFactory.namedNode('ex://p3'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g'),
        ),
      ];
      const expected = quadsArray.slice(2).concat(newQuads);
      await store.multiPut(quadsArray);
      await store.multiPatch(oldQuads, newQuads);
      const { items: quads } = await store.get({});
      should(quads).be.equalToQuadArray(expected);
    });

  });

};
