
// @ts-ignore
import SortedSet from 'js-sorted-set';
import ai from 'asynciterator';

class SortedSetIterator<T> extends ai.BufferedIterator<T> {

  constructor(set: SortedSet<T>) {

    super();

    let value: T | null;
    let iterator = set.beginIterator();

    this._read = (count, done) => {

      do {
        value = iterator.value();
        if (value === null) {
          this.close();
          return done();
        }
        this._push(value);
        iterator = iterator.next();
        count -= 1;
      } while (count > 0);

      done();

    };

  }

}

class SortIterator<T> extends ai.TransformIterator<T, T> {

  constructor(source: ai.AsyncIterator<T>, comparator: (a: T, b: T) => -1|0|1) {

    super();

    const set = new SortedSet({ comparator });

    // @ts-ignore
    source.on('data', (item: T) => {
      set.insert(item);
    });

    // @ts-ignore
    source.on('end', () => {
      this.source = new SortedSetIterator(set);
    });

  }

}

export default SortIterator;
