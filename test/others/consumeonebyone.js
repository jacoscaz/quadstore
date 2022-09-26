import { IntegerIterator } from 'asynciterator';
import { delayIterator } from '../utils/stuff.js';
import { consumeOneByOne } from '../../dist/esm/utils/consumeonebyone.js';
import { toStrictlyEqual } from '../utils/expect.js';
const createSourceIterator = () => new IntegerIterator({ start: 0, step: 1, end: 99 });
export const runConsumeOneByOneTests = () => {
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
                toStrictlyEqual(item, count++);
            });
            toStrictlyEqual(count, 100);
        });
    });
};
