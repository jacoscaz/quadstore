
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
        const patterns = [
          { subject: '?s', predicate: 'p', object: 'o' },
          { subject: '?s', predicate: 'p2', object: '?o'},
        ];
        const filters = [];
        const results = await this.store.searchStream(patterns, filters);
        should(results.type).equal(enums.resultType.BINDINGS);
        const bindings = await utils.streamToArray(results.iterator);
      });

    });

  });

}
