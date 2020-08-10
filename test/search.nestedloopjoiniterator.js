const AsyncIterator = require('asynciterator');
const NestedLoopJoinIterator = require('../dist/lib/search/iterators/nested-loop-join-iterator').default;
const should = require('should');
const utils = require('./utils');
const { streamToArray } = require('../dist/lib/utils');

module.exports = () => {

  describe('NestedLoopJoinIterator', () => {

    it('should do stuff', async function () {
      const getNestedIterator = async (base) => {
        return utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 2, step: 1 }));
      };
      const mergeItems = (outer, inner) => {
        return outer + inner;
      }
      const outer = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 8, step: 3 }));
      const iterator = new NestedLoopJoinIterator(outer, getNestedIterator, mergeItems);
      const results = await streamToArray(iterator);
      should(results).deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

    });

  });

};
