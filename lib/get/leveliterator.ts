
import {BufferedIterator} from 'asynciterator';
import {AbstractIterator} from 'abstract-leveldown';

type MapFn<K, V, T> = (key: K, value: V) => T;

export class LevelIterator<K, V, T> extends BufferedIterator<T> {

  level: AbstractIterator<K, V>;
  mapFn: MapFn<K, V, T>;
  private levelEnded: boolean;

  constructor(levelIterator: AbstractIterator<K, V>, mapper: MapFn<K, V, T>) {
    super();
    this.mapFn = mapper;
    this.level = levelIterator;
    this.levelEnded = false;
  }

  _read(qty: number, done: (err?: Error) => void) {
    const loop = (remaining: number) => {
      if (remaining === 0) {
        done();
        return;
      }
      this.level.next((err, key: K, value: V) => {
        this.onNextValue(err, key, value, remaining, loop, done);
      });
    };
    loop(qty);
  }

  protected onNextValue(
    err: Error|undefined,
    key: K,
    value: V,
    remaining: number,
    loop: (remaining: number) => void,
    done: (err?: Error) => void,
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
    this._push(this.mapFn(key, value));
    loop(remaining - 1);
  };

  /**
   * Ends the internal AbstractIterator instance.
   */
  protected endLevel(cb: (err?: Error) => void) {
    if (this.levelEnded) {
      cb();
      return;
    }
    this.level.end((err?: Error) => {
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
    this.endLevel((endErr) => {
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
    this.endLevel((endErr?: Error) => {
      if (endErr) {
        cb(endErr);
        return;
      }
      super._destroy(cause, cb);
    });
  }

}
