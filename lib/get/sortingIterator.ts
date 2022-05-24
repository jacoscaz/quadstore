
import { AsyncIterator } from 'asynciterator';

const SortedSet = require('js-sorted-set');

/**
 * Buffers all items emitted from `source` and sorts them according to
 * `compare`.
 */
export class SortingIterator<In, Int, Out> extends AsyncIterator<Out> {

  /**
   *
   * @param source
   * @param compare
   * @param digest
   * @param emit
   */
  public constructor(
    source: AsyncIterator<In>,
    compare: (left: Int, right: Int) => number,
    digest: (item: In) => Int,
    emit: (item: Int) => Out,
  ) {

    super();

    let iterator: any;

    const startBuffering = () => {
      const set = new SortedSet({ comparator: compare });
      const onData = (item: In) => {
        set.insert(digest(item));
      };
      const onError = (err: Error) => {
        this.emit('error', err);
      };
      const onEnd = () => {
        source.removeListener('data', onData);
        source.removeListener('error', onError);
        source.removeListener('end', onEnd);
        iterator = set.beginIterator();
        this.readable = true;
      };
      source.on('data', onData);
      source.on('error', onError);
      source.once('end', onEnd);
    };

    this.read = (): Out | null => {
      if (iterator) {
        const value = iterator.value();
        if (value === null) {
          this.close();
          return null;
        }
        iterator = iterator.next();
        return emit(value);
      }
      return null;
    };

    Promise.resolve().then(() => {
      startBuffering();
    });

  }

}
