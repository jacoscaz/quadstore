import { runMemoryLevelTests } from './backends/memorylevel.js';
import { runClassicLevelTests } from './backends/classiclevel.js';
import { runOtherTests } from './others/others.js';
runOtherTests();
runMemoryLevelTests();
runClassicLevelTests();
