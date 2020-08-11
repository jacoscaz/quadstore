
'use strict';

const _ = require('../dist/lib/utils');
const should = require('should');
const utils = require('../dist/lib/utils');
const { TSResultType } = require('../dist/lib/types');

module.exports = () => {

  describe('QuadStore.prototype.searchStream()', () => {

    beforeEach(async function () {
      this.quads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's', predicate: 'p2', object: 'o2', graph: 'c2'},
        {subject: 's2', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p', object: 'o2', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'},
      ];
      await this.store.multiPut(this.quads);
    });

    describe('test', () => {

      it('should match quads by subject', async function () {
        const stages = [
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p', object: 'o' } },
          { type: 'bgp', pattern: { subject: '?s', predicate: 'p2', object: '?o'} },
        ];
        const result = await this.store.search(stages);
        should(result.type).equal(TSResultType.BINDINGS);
        should(result.items).be.equalToBindingArray(
          [{'?s': 's', '?o': 'o2'}, {'?s': 's', '?o': 'o2'}],
          this.store,
          Object.keys(result.variables),
        );
      });

    });

  });

}
