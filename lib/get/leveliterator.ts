import {BufferedIterator} from 'asynciterator';
import {Quad} from '../types';
import {Quadstore} from '../quadstore';
import {AbstractIterator} from 'abstract-leveldown';
import {deserializeImportedQuad, exportQuad} from '../serialization';

export class LevelIterator extends BufferedIterator<Quad> {

  store: Quadstore;
  level: AbstractIterator<any, any>;

  constructor(store: Quadstore, levelIterator: AbstractIterator<string, Buffer>) {
    super();
    this.store = store;
    this.level = levelIterator;
  }

  _read(qty: number, done: (err?: Error) => void) {
    const loop = (remaining: number) => {
      if (remaining === 0) {
        done();
        return;
      }
      this.level.next((err, key: Buffer|undefined, value: Buffer|undefined) => {
        this.onNextValue(err, key, value, remaining, loop, done);
      });
    };
    loop(qty);
  }

  protected onNextValue(
    err: Error|undefined,
    key: Buffer|undefined,
    value: Buffer|undefined,
    remaining: number,
    loop: (remaining: number) => void,
    done: (err?: Error) => void,
  ) {
    if (err) {
      done(err);
      return;
    }
    if (value === undefined) {
      this.close();
      done();
      return;
    }
    this._push(exportQuad(
      deserializeImportedQuad(value.toString('utf8')),
      this.store.defaultGraph,
      this.store.dataFactory,
      this.store.prefixes
    ));
    loop(remaining - 1);
  };


  protected _end(destroy?: boolean) {
    super._end(destroy);
    if (!destroy) {
      this.level.end((endErr?: Error) => {
        if (endErr) {
          this.emit('error', endErr);
        }
      });
    }
  }

  protected _destroy(cause: Error|undefined, cb: (err?: Error) => void) {
    super._destroy(cause, (destroyErr?: Error) => {
      if (destroyErr) {
        cb(destroyErr);
        return;
      }
      this.level.end(cb);
    });
  }

}
