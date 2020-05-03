
const SortedSet = require('js-sorted-set');
const AsyncIterator = require('asynciterator');

class SortedSetIterator extends AsyncIterator.BufferedIterator {

  constructor(set) {

    super();

    let value = null;
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

class SortIterator extends AsyncIterator.TransformIterator {

  constructor(source, comparator) {

    super();

    const set = new SortedSet({ comparator });

    source.on('data', (item) => {
      set.insert(item);
    });

    source.on('end', () => {
      this.source = new SortedSetIterator(set);
    });

  }

}

module.exports = SortIterator;
