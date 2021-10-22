
import type { AsyncIterator } from 'asynciterator';
import {BufferedIterator, TransformIterator} from 'asynciterator';

const SortedSet = require('js-sorted-set');

/**
 * Buffers all items emitted from `source` and sorts them according to
 * `compare`.
 */
export class SortingIterator<T> extends BufferedIterator<T> {

  private iterator?: any;

  /**
   *
   * @param source
   * @param compare
   * @param prepare
   * @param options
   */
  public constructor(source: AsyncIterator<T>, compare: (left: T, right: T) => number, prepare: (item: T) => T, options?: any) {

    super(options);

    this._read = (count: number, done: () => void): void => {
      const set = new SortedSet({ comparator: compare });
      const onData = (item: T) => {
        set.insert(prepare(item));
      };
      const onEnd = () => {
        source.removeListener('data', onData);
        this.iterator = set.beginIterator();
        // @ts-ignore
        delete this._read;
        this._read(count, done);
      };
      source.on('data', onData);
      source.once('end', onEnd);
    };

  }

  public _read(count: number, done: () => void): void {
    let iterator = this.iterator;
    let value;
    while (count >= 0) {
      if ((value = iterator.value()) === null) {
        done();
        this.close();
        return;
      }
      this._push(value);
      iterator = iterator.next();
      count -= 1;
    }
    this.iterator = iterator;
    done();
  }

}
