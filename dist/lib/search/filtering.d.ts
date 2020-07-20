import { TSBinding, TSParsedFilterSearchStage } from '../types';
export declare const compileFilter: (stage: TSParsedFilterSearchStage) => (binding: TSBinding) => boolean;
export declare const getFilterTermRange: (stage: TSParsedFilterSearchStage) => {
    lt: string;
    lte?: undefined;
    gt?: undefined;
    gte?: undefined;
} | {
    lte: string;
    lt?: undefined;
    gt?: undefined;
    gte?: undefined;
} | {
    gt: string;
    lt?: undefined;
    lte?: undefined;
    gte?: undefined;
} | {
    gte: string;
    lt?: undefined;
    lte?: undefined;
    gt?: undefined;
} | null;
