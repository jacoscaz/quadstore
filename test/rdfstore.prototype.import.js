
'use strict';

const _ = require('../lib/utils/lodash');
const utils = require('../lib/utils');
const should = require('should');
const factory = require('n3').DataFactory;
const AsyncIterator = require('asynciterator');

module.exports = () => {

  describe('RdfStore.prototype.import()', () => {

    it('should import a single quad correctly', async function () {
      const store = this.store;
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('o', 'en-gb'),
          factory.namedNode('http://ex.com/g')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      await utils.waitForEvent(store.import(source), 'end', true);
      const matchedQuads = await utils.streamToArray(store.match());
      should(matchedQuads).have.length(1);
    });

    it('should import multiple quads correctly', async function () {
      const store = this.store;
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s0'),
          factory.namedNode('http://ex.com/p0'),
          factory.literal('o0', 'en-gb'),
          factory.namedNode('http://ex.com/g0')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s1'),
          factory.namedNode('http://ex.com/p1'),
          factory.literal('o1', 'en-gb'),
          factory.namedNode('http://ex.com/g1')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('o2', 'en-gb'),
          factory.namedNode('http://ex.com/g3')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      await utils.waitForEvent(store.import(source), 'end', true);
      const matchedQuads = await utils.streamToArray(store.match());
      should(matchedQuads).have.length(3);
    });

  });
};
