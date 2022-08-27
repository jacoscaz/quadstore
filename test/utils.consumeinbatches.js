
const should = require('should');
const { IntegerIterator } = require('asynciterator');
const { delayIterator } = require('./utils');
const { consumeInBatches } = require('../dist/cjs/utils/consumeinbatches');

const createSourceIterator = () => new IntegerIterator({ start: 0, step: 1, end: 99 });

module.exports = () => {

  describe('consumeInBatches()', () => {

    let source;
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

    afterEach(async () => {
      let itemValue = 0;
      let itemCount = 0;
      let batchCount = 0;
      let last = false;
      await consumeInBatches(source, batchSize, async (batch) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        should(last).eql(false);
        should(batch.length).be.lessThanOrEqual(batchSize);
        last = batch.length < batchSize;
        itemCount += batch.length;
        batchCount += 1;
        for (let i = 0; i < batch.length; i += 1) {
          should(batch[i]).eql(itemValue++);
        }
      });
      should(itemCount).eql(100);
      should(batchCount).eql(Math.ceil(100 / batchSize));
    });

    describe('with an IntegerIterator as the source', () => {
      beforeEach(() => {
        source = createSourceIterator();
      });
      runTests();
    });

    describe('with an asynchronous IntegerIterator as the source', () => {
      beforeEach(() => {
        source = delayIterator(createSourceIterator(), 2);
      });
      runTests();
    });

  });

};
