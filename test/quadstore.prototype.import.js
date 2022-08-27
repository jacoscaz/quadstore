
'use strict';

const should = require('should');
const AsyncIterator = require('asynciterator');
const { waitForEvent, streamToArray } = require('../dist/cjs/utils/stuff');

module.exports = () => {

  describe('Quadstore.prototype.import()', () => {

    it('should import a single quad correctly', async function () {
      const { dataFactory, store } = this;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('o', 'en-gb'),
          dataFactory.namedNode('http://ex.com/g')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      await waitForEvent(store.import(source), 'end', true);
      const matchedQuads = await streamToArray(store.match());
      should(matchedQuads).have.length(1);
    });

    it('should import multiple quads correctly', async function () {
      const { dataFactory, store } = this;
      const quads = [
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
          dataFactory.namedNode('http://ex.com/g3')
        )
      ];
      const source = new AsyncIterator.ArrayIterator(quads);
      await waitForEvent(store.import(source), 'end', true);
      const matchedQuads = await streamToArray(store.match());
      should(matchedQuads).have.length(3);
    });

  });
};
