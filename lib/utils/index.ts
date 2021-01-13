
import {TSReadable, TermName, Binding} from '../types';
import {EventEmitter} from 'events';
import {TransformIterator} from 'asynciterator';
import {flatMap} from './flatmap.js';
import {pReduce} from './p-reduce';
import { nanoid } from 'nanoid';
import {Quad, Term} from 'rdf-js';

export { nanoid };

export const termNames: TermName[] = [
  'subject',
  'predicate',
  'object',
  'graph',
];

export const isObject = (o: any): boolean => {
  return typeof(o) === 'object' && o !== null;
};

export const streamToArray = <T>(readStream: TSReadable<T>): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const chunks: T[] = [];
    readStream
      .on('data', (chunk) => { chunks.push(chunk); })
      .on('end', () => { resolve(chunks); })
      .on('error', (err) => { reject(err); });
  });
}

export const resolveOnEvent = (emitter: EventEmitter, event: string, rejectOnError?: boolean): Promise<any> => {
  return new Promise((resolve, reject) => {
    emitter.on(event, resolve);
    if (rejectOnError) {
      emitter.on('error', reject);
    }
  });
}

export const waitForEvent = resolveOnEvent;

export const defaultIndexes: TermName[][] = [
  ['subject', 'predicate', 'object', 'graph'],
  ['object', 'graph', 'subject', 'predicate'],
  ['graph', 'subject', 'predicate', 'object'],
  ['subject', 'object', 'predicate', 'graph'],
  ['predicate', 'object', 'graph', 'subject'],
  ['graph', 'predicate', 'object', 'subject'],
];

class BatchingIterator<T> extends TransformIterator<T, T> {

  constructor(source: TSReadable<T>, batchSize: number, onEachBatch: (items: T[]) => Promise<void>) {

    // @ts-ignore
    super(source);

    let ind = 0;
    const buf = new Array(batchSize);

    this._transform = (item: T, done: () => void) => {
      buf[ind++] = item;
      if (ind < batchSize) {
        done();
        return;
      }
      ind = 0;
      onEachBatch(buf).then(done.bind(null, null)).catch(done);
    };

    this._flush = (done: () => void) => {
      if (ind === 0) {
        done();
        return;
      }
      onEachBatch(buf.slice(0, ind)).then(done.bind(null, null)).catch(done);
    };

  }

}

export const consumeInBatches = async <T>(iterator: TSReadable<T>, batchSize: number, onEachBatch: (items: T[]) => Promise<any>) => {
  return new Promise((resolve, reject) => {
    new BatchingIterator(iterator, batchSize, onEachBatch)
      .on('end', resolve)
      .on('error', reject);
  });
};

export const consumeOneByOne = async <T>(iterator: TSReadable<T>, onEachItem: (item: T) => any | Promise<any>) => {
  return new Promise<void>((resolve, reject) => {
    let ended = false;
    let waiting = false;
    let working = false;
    const loop = () => {
      working = false;
      waiting = false;
      const item = iterator.read();
      if (item === null) {
        if (ended) {
          resolve();
        } else {
          waiting = true;
          iterator.once('readable', loop);
        }
        return;
      }
      working = true;
      Promise.resolve(onEachItem(item)).then(loop).catch(reject);
    };
    iterator.once('end', () => {
      ended = true;
      if (waiting) {
        iterator.removeListener('readable', loop);
        resolve();
      }
      if (!working) {
        resolve();
      }
    });
    loop();
  });
};

export { flatMap };
export { pReduce };

export const pFromCallback = <T>(fn: (cb: (err: Error|undefined|null, val?: T) => void) => void): Promise<T|undefined> => {
  return new Promise((resolve, reject) => {
    fn((err: Error|undefined|null, val?: T) => {
      err ? reject(err) : resolve(val);
    });
  });
};

export const emptyArray: any[] = [];
export const emptyObject: { [key: string]: any } = {};

export const boundary = '\uDBFF\uDFFF';
export const separator = '\u0000\u0000';

export const getTermComparator = (): (a: Term, b: Term) => (-1 | 0 | 1) => {
  return (a: Term, b: Term): -1|0|1 => {
    if (a.termType !== b.termType) {
      return a.termType < b.termType ? -1 : 1;
    }
    if (a.termType !== 'Literal' || b.termType !== 'Literal') {
      return a.value < b.value ? -1 : (a.value === b.value ? 0 : 1);
    }
    if (a.language || b.language) {
      if (!a.language) {
        return -1;
      }
      if (!b.language) {
        return 1;
      }
      return a.language < b.language ? -1 : (a.language === b.language ? 0 : 1);
    }
    if (a.datatype || b.datatype) {
      if (!a.datatype) {
        return -1;
      }
      if (!b.datatype) {
        return 1;
      }
      if (a.datatype.value !== b.datatype.value) {
        return a.datatype.value < b.datatype.value ? -1 : 1;
      }
    }
    return a.value < b.value ? -1 : (a.value === b.value ? 0 : 1);
  };
}

export const getQuadComparator = (_termNames: TermName[] = termNames): (a: Quad, b: Quad) => (-1 | 0 | 1) => {
  const termComparator = getTermComparator();
  return (a: Quad, b: Quad) => {
    for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
      r = termComparator(a[_termNames[i]], b[_termNames[i]]);
      if (r !== 0) return r;
    }
    return 0;
  };
}

export const getBindingComparator = (_termNames: string[] = termNames): (a: Binding, b: Binding) => -1|0|1 => {
  const termComparator = getTermComparator();
  return (a: Binding, b: Binding) => {
    for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
      r = termComparator(a[_termNames[i]], b[_termNames[i]]);
      if (r !== 0) return r;
    }
    return 0;
  };
}
