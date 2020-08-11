
'use strict';

const _ = require('../dist/lib/utils');
const should = require('should');
const utils = require('../dist/lib/utils');
const { TSResultType } = require('../dist/lib/types');

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

      it('should materialize quads', async function () {
        const stages = [
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p', object: 'o' } },
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p2', object: '?o'} },
          { type: 'construct', patterns: [{ subject: '?s', predicate: 'likes', object: 'boats', graph: 'default' }] },
        ];
        const results = await this.store.search(stages);
        should(results.type).equal(TSResultType.QUADS);
        should(results.items).be.equalToQuadArray(
          [
            { subject: 's', predicate: 'likes', object: 'boats', graph: 'default' },
            { subject: 's2', predicate: 'likes', object: 'boats', graph: 'default' }
          ],
          this.store,
        );
      });

    });

  });

}
