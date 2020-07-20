import ai from 'asynciterator';
declare class NestedLoopJoinIterator<T> extends ai.BufferedIterator<T> {
    constructor(outerIterator: ai.AsyncIterator<T>, getInnerIterator: (t: T) => Promise<ai.AsyncIterator<T>>, mergeItems: (o: T, i: T) => T);
}
export default NestedLoopJoinIterator;
