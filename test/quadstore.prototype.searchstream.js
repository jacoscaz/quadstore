
'use strict';

const _ = require('../dist-cjs/lib/utils');
const should = require('should');
const utils = require('../dist-cjs/lib/utils');
const { TSResultType } = require('../dist-cjs/lib/types');

module.exports = () => {

  describe('QuadStore.prototype.searchStream()', () => {

    beforeEach(async function () {
      await this.store.multiPut([
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's', predicate: 'p2', object: 'o2', graph: 'c2'},
        {subject: 's2', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p', object: 'o2', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'},
      ]);
    });

    describe('test', () => {

      it('should match quads by subject', async function () {
        const stages = [
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p', object: 'o' } },
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p2', object: '?o'} },
        ];
        const results = await this.store.searchStream(stages);
        should(results.type).equal(TSResultType.BINDINGS);
        const bindings = await utils.streamToArray(results.iterator);
      });

      it('should materialize quads', async function () {
        const stages = [
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p', object: 'o' } },
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p2', object: '?o'} },
          { type: 'construct', patterns: [{ subject: '?s', predicate: 'likes', object: 'boats', graph: 'default' }] },
        ];
        const results = await this.store.searchStream(stages);
        should(results.type).equal(TSResultType.QUADS);
        const quads = await utils.streamToArray(results.iterator);
      });

    });

  });

}
