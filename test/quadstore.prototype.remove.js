
'use strict';

const _ = require('../dist/lib/utils');
const utils = require('../dist/lib/utils');
const should = require('should');
const AsyncIterator = require('asynciterator');

module.exports = () => {

  describe('Quadstore.prototype.remove()', () => {

    it('should remove streamed quads correctly', async function () {
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
          dataFactory.namedNode('http://ex.com/g3')
        )
      ];
      const removeQuads = [
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
      const importStream = new AsyncIterator.ArrayIterator(importQuads);
      const removeStream = new AsyncIterator.ArrayIterator(removeQuads);
      await utils.waitForEvent(store.import(importStream), 'end', true);
      await utils.waitForEvent(store.remove(removeStream), 'end', true);
      const matchedQuads = await utils.streamToArray(store.match());
      should(matchedQuads).have.length(1);
    });

  });

};
