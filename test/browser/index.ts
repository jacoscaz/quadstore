
import { runMemoryLevelTests } from '../backends/memorylevel';
import { runBrowserLevelTests } from '../backends/browserlevel';
import { runOtherTests } from '../others/others';

runOtherTests();
runMemoryLevelTests();
runBrowserLevelTests();
