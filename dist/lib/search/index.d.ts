import { TSBindingStreamResult, TSQuadStreamResult, TSSearchStage } from '../types';
import QuadStore from '../quadstore';
export declare const searchStream: (store: QuadStore, stages: TSSearchStage[]) => Promise<TSQuadStreamResult | TSBindingStreamResult>;
