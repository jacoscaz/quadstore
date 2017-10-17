
'use strict';

const _ = require('lodash');
const utils = require('../lib/utils');
const should = require('should');
const asynctools = require('asynctools');

module.exports = () => {
  describe('RdfStore.prototype.removeMatches()', () => {
    it('should remove matching quads correctly', async function () {
      const store = this.store;
      const factory = this.store.dataFactory;
      const importQuads = [
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
          factory.namedNode('http://ex.com/g1')
        )
      ];
      const importStream = utils.createArrayStream(importQuads);
      await asynctools.onEvent(store.import(importStream), 'end', true);
      await asynctools.onEvent(store.removeMatches(null, null, null, factory.namedNode('http://ex.com/g1')), 'end', true);
      const matchedQuads = await utils.streamToArray(store.match());
      should(matchedQuads).have.length(1);
    });
  });
};
