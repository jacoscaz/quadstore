
import type { AbstractIterator } from 'abstract-level';
import { BufferedIterator } from 'asynciterator';

type MapFn<K, V, T> = (key: K, value: V) => T;
type OnNextValue<K, V> = (err: Error | null | undefined, key: K | undefined, value: V | undefined) => any;
type ReadState<K, V> = { remaining: number, next: OnNextValue<K, V> };

export class LevelIterator<K, V, T> extends BufferedIterator<T> {

  level: AbstractIterator<any, K, V>;
  mapFn: MapFn<K, V, T>;
  private levelEnded: boolean;

  constructor(levelIterator: AbstractIterator<any, K, V>, mapper: MapFn<K, V, T>) {
    super({ maxBufferSize: 64 });
    this.mapFn = mapper;
    this.level = levelIterator;
    this.levelEnded = false;
  }

  _read(qty: number, done: (err?: Error) => void) {
    const state: Partial<ReadState<K, V>> = { remaining: qty };
    state.next = this._onNextValue.bind(this, state as ReadState<K, V>, done);
    this.level.next(state.next);
  }

  protected _onNextValue(
    state: ReadState<K, V>,
    done: (err?: Error) => void,
    err: Error | null | undefined,
    key: K | undefined,
    value: V | undefined,
  ) {
    if (err) {
      done(err);
      return;
    }
    if (key === undefined && value === undefined) {
      this.close();
      this.levelEnded = true;
      done();
      return;
    }
    this._push(this.mapFn(key!, value!));
    state.remaining -= 1;
    if (state.remaining === 0) {
      done();
      return;
    }
    this.level.next(state.next);
  };

  /**
   * Ends the internal AbstractIterator instance.
   */
  protected _endLevel(cb: (err?: Error | null) => void) {
    if (this.levelEnded) {
      cb();
      return;
    }
    this.level.close((err?: Error | null) => {
      if (!err) {
        this.levelEnded = true;
      }
      cb(err);
    });
  }


  protected _end(destroy?: boolean) {
    if (this.ended) {
      return;
    }
    super._end(destroy);
    this._endLevel((endErr) => {
      if (endErr) {
        this.emit('error', endErr);
      }
    });
  }

  protected _destroy(cause: Error|undefined, cb: (err?: Error) => void) {
    if (this.destroyed) {
      cb();
      return;
    }
    this._endLevel((endErr?: Error | null) => {
      if (endErr) {
        cb(endErr);
        return;
      }
      super._destroy(cause, cb);
    });
  }

}
