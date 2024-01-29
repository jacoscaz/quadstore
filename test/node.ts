
import { runMemoryLevelTests } from './backends/memorylevel';
import { runClassicLevelTests } from './backends/classiclevel';
import { runRocksLevelNXTEditionTests } from './backends/rockslevel-nxtedition';
import { runOtherTests } from './others/others';

runOtherTests();
runMemoryLevelTests();
runClassicLevelTests();
runRocksLevelNXTEditionTests();

