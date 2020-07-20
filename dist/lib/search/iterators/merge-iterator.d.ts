import ai from 'asynciterator';
declare class MergeIterator<T> extends ai.BufferedIterator<T> {
    constructor(a: ai.AsyncIterator<T>, b: ai.AsyncIterator<T>, compare: (a: T, b: T) => number, push: (a: T, b: T) => T);
}
export default MergeIterator;
