
import { AsyncIterator } from 'asynciterator';
import { RESOLVED } from '../utils/stuff';

let sortedSetImportErr: Error;

let SortedSet: any = class {
  constructor() {
    throw new Error(`Failed to require module js-sorted-set: ${sortedSetImportErr?.message}`);
  }
};

// @ts-ignore
import('js-sorted-set')
  .then((_) => { SortedSet = _.default; })
  .catch((err) => { sortedSetImportErr = err; });

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
      const cleanup = () => {
        source.removeListener('data', onData);
        source.removeListener('error', onError);
        source.removeListener('end', onEnd);
        source.destroy();
      };
      const onData = (item: In) => {
        set.insert(digest(item));
      };
      const onError = (err: Error) => {
        cleanup();
        this.emit('error', err);
      };
      const onEnd = () => {
        cleanup();
        iterator = set.beginIterator();
        this.readable = true;
      };
      source.on('data', onData);
      source.on('error', onError);
      source.on('end', onEnd);
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
      this.readable = false;
      return null;
    };

    RESOLVED.then(startBuffering).catch((err) => {
      RESOLVED.then(() => this.emit('error', err));
    });

  }

}
