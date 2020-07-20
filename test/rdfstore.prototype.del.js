
'use strict';

const _ = require('../dist-cjs/lib/utils/lodash');
const utils = require('../dist-cjs/lib/utils');
const should = require('should');
const factory = require('n3').DataFactory;

module.exports = () => {

  describe('RdfStore.prototype.del()', () => {

    it('Should delete matching quads correctly (callback).', async function () {
      const store = this.store;
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s0'),
          factory.namedNode('http://ex.com/p0'),
          factory.literal('o0', 'en-gb'),
          factory.namedNode('http://ex.com/g0')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s0'),
          factory.namedNode('http://ex.com/p1'),
          factory.literal('o1', 'en-gb'),
          factory.namedNode('http://ex.com/g1')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p1'),
          factory.literal('o2', 'en-gb'),
          factory.namedNode('http://ex.com/g1')
        )
      ];
      await store.put(quads);
      await store.del({ subject: factory.namedNode('http://ex.com/s0') });
      const { items: foundQuads } = await store.get({});
      should(foundQuads).have.length(1);
    });
  });

};
