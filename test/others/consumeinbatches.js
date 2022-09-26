import { IntegerIterator } from 'asynciterator';
import { delayIterator } from '../utils/stuff.js';
import { consumeInBatches } from '../../dist/esm/utils/consumeinbatches.js';
import { toStrictlyEqual, toBeFalse, toBeLessThanOrEqualTo } from '../utils/expect.js';
const createSourceIterator = () => new IntegerIterator({ start: 0, step: 1, end: 99 });
export const runConsumeInBatchesTests = () => {
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
                toBeFalse(last);
                toBeLessThanOrEqualTo(batch.length, batchSize);
                last = batch.length < batchSize;
                itemCount += batch.length;
                batchCount += 1;
                for (let i = 0; i < batch.length; i += 1) {
                    toStrictlyEqual(batch[i], itemValue++);
                }
            });
            toStrictlyEqual(itemCount, 100);
            toStrictlyEqual(batchCount, Math.ceil(100 / batchSize));
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
