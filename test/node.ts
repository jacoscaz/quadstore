
import { runMemoryLevelTests } from './backends/memorylevel';
import { runClassicLevelTests } from './backends/classiclevel';
import { runOtherTests } from './others/others';

runOtherTests();
runMemoryLevelTests();
runClassicLevelTests();

