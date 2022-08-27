
const should = require('should');
const { IntegerIterator } = require('asynciterator');
const { delayIterator } = require('./utils');
const { consumeOneByOne } = require('../dist/cjs/utils/consumeonebyone');

const createSourceIterator = () => new IntegerIterator({ start: 0, step: 1, end: 99 });

module.exports = () => {

  describe('consumeOneByOne()', () => {

    let source;

    it('should consume an IntegerIterator', () => {
      source = createSourceIterator();
    });

    it('should consume an asynchronous IntegerIterator', () => {
      source = delayIterator(createSourceIterator());
    });

    afterEach(async () => {
      let count = 0;
      await consumeOneByOne(source, async (item) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        should(item).eql(count++);
      });
      should(count).eql(100);
    });

  });

};
