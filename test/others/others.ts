
import { runFpstringTests } from './fpstring';
import { runConsumeOneByOneTests } from './consumeonebyone';
import { runConsumeInBatchesTests } from './consumeinbatches';

export const runOtherTests = () => {
  runFpstringTests();
  runConsumeOneByOneTests();
  runConsumeInBatchesTests();
};
