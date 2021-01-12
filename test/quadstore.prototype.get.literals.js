
'use strict';

const _ = require('../dist/lib/utils');
const xsd = require('../dist/lib/serialization/xsd');
const should = require('should');

module.exports = () => {

  describe('Quadstore.prototype.get() with literals', () => {

    it('should match quads by numeric object', async function () {
      const { dataFactory, store } = this;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('1', xsd.integer),
          dataFactory.namedNode('http://ex.com/g2')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal('2', xsd.integer),
          dataFactory.namedNode('http://ex.com/g2')
        )
      ];
      await store.multiPut(quads);
      const { items } = await store.get({ object: dataFactory.literal('2', xsd.integer) });
      should(items).be.equalToQuadArray([quads[1]], store);
    });

  });

};
