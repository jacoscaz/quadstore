
'use strict';

const _ = require('../dist/lib/utils');
const xsd = require('../dist/lib/serialization/xsd');
const should = require('should');
const factory = require('@rdfjs/data-model');

module.exports = () => {

  describe('QuadStore.prototype.get() with literals', () => {

    it('should match quads by numeric object', async function () {
      const store = this.store;
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('1', xsd.integer),
          factory.namedNode('http://ex.com/g2')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('2', xsd.integer),
          factory.namedNode('http://ex.com/g2')
        )
      ];
      await store.multiPut(quads);
      const { items } = await store.get({ object: factory.literal('2', xsd.integer) });
      should(items).be.equalToQuadArray([quads[1]], store);
    });

  });

};
