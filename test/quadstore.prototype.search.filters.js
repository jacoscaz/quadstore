
'use strict';

const _ = require('../dist/lib/utils');
const should = require('should');
const utils = require('../dist/lib/utils');
const { TSResultType } = require('../dist/lib/types');

module.exports = () => {

  describe('filters', () => {

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

    it('should filter by equality', async function () {
      const stages = [
        { type: 'bgp', pattern: { subject: '?s' } },
        { type: 'eq', args: ['?s', 's2'] },
      ];
      const result = await this.store.search(stages);
      should(result.type).equal(TSResultType.BINDINGS);
      should(result.items).be.equalToBindingArray(
        [{'?s': 's2'}, {'?s': 's2'}, {'?s': 's2'}],
        this.store,
        Object.keys(result.variables),
      );
    });

    it('should filter by inequality', async function () {
      const stages = [
        { type: 'bgp', pattern: { subject: '?s' } },
        { type: 'neq', args: ['?s', 's2'] },
      ];
      const result = await this.store.search(stages);
      should(result.type).equal(TSResultType.BINDINGS);
      should(result.items).be.equalToBindingArray(
        [{'?s': 's'}, {'?s': 's'}],
        this.store,
        Object.keys(result.variables),
      );
    });

  });

}
