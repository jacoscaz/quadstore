
const should = require('should');
const { IntegerIterator } = require('asynciterator');
const { delayIterator } = require('./utils');
const { consumeInBatches } = require('../dist/utils/consumeinbatches');

module.exports = () => {

  describe('consumeInBatches()', () => {

    let batchSize;

    const runTests = () => {

      it('should work with a batchSize of 1', () => {
        batchSize = 1;
      });

      it('should work with a batchSize equal to the total number of items', () => {
        batchSize = 100;
      });

      it('should work with a batchSize that is a perfect divisor of the number of items', () => {
        batchSize = 10;
      });

      it('should work with a batchSize that is not a perfect divisor of the number of items (1)', () => {
        batchSize = 13;
      });

      it('should work with a batchSize that is not a perfect divisor of the number of items (2)', () => {
        batchSize = 67;
      });

    };

    let source;

    afterEach(async () => {
      let itemCount = 0;
      let batchCount = 0;
      let last = false;
      await consumeInBatches(source, batchSize, async (batch) => {
        should(last).eql(false);
        should(batch.length).be.lessThanOrEqual(batchSize);
        last = batch.length < batchSize;
        itemCount += batch.length;
        batchCount += 1;
      });
      should(itemCount).eql(100);
      should(batchCount).eql(Math.ceil(100 / batchSize));
    });

    describe('with an IntegerIterator as the source', () => {
      beforeEach(() => {
        source = new IntegerIterator({ start: 0, step: 1, end: 99 });
      });
      runTests();
    });

    describe('with an asynchronous IntegerIterator as the source', () => {
      beforeEach(() => {
        source = delayIterator(new IntegerIterator({ start: 0, step: 1, end: 99 }), 2);
      });
      runTests();
    });

  });

};
