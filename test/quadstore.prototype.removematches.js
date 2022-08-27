
'use strict';

const should = require('should');
const AsyncIterator = require('asynciterator');
const { streamToArray, waitForEvent } = require('../dist/cjs/utils/stuff');

module.exports = () => {
  describe('Quadstore.prototype.removeMatches()', () => {
    it('should remove matching quads correctly', async function () {
      const { dataFactory, store } = this;
      const importQuads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s0'),
          dataFactory.namedNode('http://ex.com/p0'),
          dataFactory.literal('o0', 'en-gb'),
          dataFactory.namedNode('http://ex.com/g0')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s1'),
          dataFactory.namedNode('http://ex.com/p1'),
          dataFactory.literal('o1', 'en-gb'),
          dataFactory.namedNode('http://ex.com/g1')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal('o2', 'en-gb'),
          dataFactory.namedNode('http://ex.com/g1')
        )
      ];
      const importStream = new AsyncIterator.ArrayIterator(importQuads);
      await waitForEvent(store.import(importStream), 'end', true);
      await waitForEvent(store.removeMatches(null, null, null, dataFactory.namedNode('http://ex.com/g1')), 'end', true);
      const matchedQuads = await streamToArray(store.match());
      should(matchedQuads).have.length(1);
    });
  });
};
