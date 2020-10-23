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
    let pending = qty;
    const loop = () => {
      if (pending === 0) {
        done();
        return;
      }
      this.level.next((err, key, value) => {
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

        pending -= 1;
        loop();
      });
    };
    loop();
  }

  protected _end(destroy?: boolean) {
    super._end(destroy);
  }

  protected _destroy(cause: Error|undefined, callback: (error?: Error) => void) {
    super._destroy(cause, (destroyErr?: Error) => {
      this.level.end((endErr?: Error) => {
        callback(destroyErr);
      });
    });
  }

}
