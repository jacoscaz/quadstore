
'use strict';

const _ = require('../lib/utils/lodash');
const should = require('should');
const utils = require('../lib/utils');
const enums = require('../lib/utils/enums');

module.exports = () => {

  describe('QuadStore.prototype.searchStream()', () => {

    beforeEach(async function () {
      await this.store.put([
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
        should(results.type).equal(enums.resultType.BINDINGS);
        const bindings = await utils.streamToArray(results.iterator);
      });

    });

  });

}
