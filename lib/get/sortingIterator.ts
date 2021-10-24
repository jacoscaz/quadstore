
import type { AsyncIterator } from 'asynciterator';
import {BufferedIterator, TransformIterator} from 'asynciterator';

const SortedSet = require('js-sorted-set');

/**
 * Buffers all items emitted from `source` and sorts them according to
 * `compare`.
 */
export class SortingIterator<In, Int, Out> extends BufferedIterator<Out> {

  private publish: (item: Int) => Out;
  private iterator?: any;

  /**
   *
   * @param source
   * @param compare
   * @param digest
   * @param emit
   * @param options
   */
  public constructor(
    source: AsyncIterator<In>,
    compare: (left: Int, right: Int) => number,
    digest: (item: In) => Int,
    emit: (item: Int) => Out,
    options?: any,
  ) {

    super(options);

    this.publish = emit;

    this._read = (count: number, done: () => void): void => {
      const set = new SortedSet({ comparator: compare });
      const onData = (item: In) => {
        set.insert(digest(item));
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
    let publish = this.publish!;
    let value;
    while (count >= 0) {
      if ((value = iterator.value()) === null) {
        done();
        this.close();
        return;
      }
      this._push(publish(value));
      iterator = iterator.next();
      count -= 1;
    }
    this.iterator = iterator;
    done();
  }

}
