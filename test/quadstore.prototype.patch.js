
'use strict';

const _ = require('../dist/lib/utils');
const should = require('./should');
const { quadArrayEqual } = require('./utils');
const dataFactory = require('@rdfjs/data-model');

module.exports = () => {

  describe('QuadStore.prototype.patch()', () => {

    const quadsSamples = [
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

    it('should delete old quads and add new ones', async function () {
      const store = this.store;
      const quadsArray = quadsSamples;
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
      const expected = quadsSamples.slice(2).concat(newQuads);
      await store.multiPut(quadsArray);
      await store.multiPatch(oldQuads, newQuads);
      const { items: quads } = await store.get({});
      should(quads).be.equalToQuadArray(expected, store);
    });

  });

};
