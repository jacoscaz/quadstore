import { runFpstringTests } from './fpstring.js';
import { runConsumeOneByOneTests } from './consumeonebyone.js';
import { runConsumeInBatchesTests } from './consumeinbatches.js';
export const runOtherTests = () => {
    runFpstringTests();
    runConsumeOneByOneTests();
    runConsumeInBatchesTests();
};
