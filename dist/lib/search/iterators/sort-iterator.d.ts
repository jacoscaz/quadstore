import ai from 'asynciterator';
declare class SortIterator<T> extends ai.TransformIterator<T, T> {
    constructor(source: ai.AsyncIterator<T>, comparator: (a: T, b: T) => -1 | 0 | 1);
}
export default SortIterator;
