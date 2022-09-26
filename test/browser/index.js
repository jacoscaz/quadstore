import { runMemoryLevelTests } from '../backends/memorylevel.js';
import { runBrowserLevelTests } from '../backends/browserlevel.js';
import { runOtherTests } from '../others/others.js';
runOtherTests();
runMemoryLevelTests();
runBrowserLevelTests();
