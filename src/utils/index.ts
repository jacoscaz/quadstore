
import type { EventEmitter } from 'events';
import type { TSReadable, TermName, Binding } from '../types';
import type { AbstractLevel } from 'abstract-level';

import { TransformIterator } from 'asynciterator';
import { Quad, Term } from 'rdf-js';

export { flatMap } from './flatmap';
export { pReduce } from './p-reduce';
export { nanoid } from './nanoid';

export const termNames: TermName[] = [
  'subject',
  'predicate',
  'object',
  'graph',
];

export const isObject = (o: any): boolean => {
  return typeof(o) === 'object' && o !== null;
};

export const isAbstractLevel = <TDatabase, K, V>(o: any): o is AbstractLevel<TDatabase, K, V> => {
  return isObject(o)
    && typeof(o.open) === 'function'
    && typeof(o.batch) === 'function'
  ;
};

export const ensureAbstractLevel = (o: any, key: string) => {
  if (!isAbstractLevel(o)) {
    throw new Error(`${key} is not an AbstractLevel instance`);
  }
};

export const streamToArray = <T>(readStream: TSReadable<T>): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const chunks: T[] = [];
    const onData = (chunk: T) => {
      chunks.push(chunk);
    };
    const onceEnd = () => {
      readStream.removeListener('data', onData);
      readStream.removeListener('error', onceError);
      resolve(chunks);
    };
    const onceError = (err: Error) => {
      readStream.removeListener('data', onData);
      readStream.removeListener('end', onceEnd);
      readStream.destroy();
      reject(err);
    };
    readStream.once('error', onceError);
    readStream.once('end', onceEnd);
    readStream.on('data', onData);
  });
}

export const resolveOnEvent = (emitter: EventEmitter, event: string, rejectOnError?: boolean): Promise<any> => {
  return new Promise((resolve, reject) => {
    const onceEvent = (arg: any) => {
      emitter.removeListener('error', onceError);
      resolve(arg);
    };
    const onceError = (err: Error) => {
      emitter.removeListener(event, onceEvent);
      reject(err);
    };
    emitter.once(event, onceEvent);
    if (rejectOnError) {
      emitter.once('error', onceError);
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

export const pFromCallback = <T>(fn: (cb: (err: Error|undefined|null, val?: T) => void) => void): Promise<T|undefined> => {
  return new Promise((resolve, reject) => {
    fn((err: Error|undefined|null, val?: T) => {
      err ? reject(err) : resolve(val);
    });
  });
};

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
};

export const getQuadComparator = (_termNames: TermName[] = termNames): (a: Quad, b: Quad) => (-1 | 0 | 1) => {
  const termComparator = getTermComparator();
  return (a: Quad, b: Quad) => {
    for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
      r = termComparator(a[_termNames[i]], b[_termNames[i]]);
      if (r !== 0) return r;
    }
    return 0;
  };
};

export const getBindingComparator = (_termNames: string[] = termNames): (a: Binding, b: Binding) => -1|0|1 => {
  const termComparator = getTermComparator();
  return (a: Binding, b: Binding) => {
    for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
      r = termComparator(a[_termNames[i]], b[_termNames[i]]);
      if (r !== 0) return r;
    }
    return 0;
  };
};

export const arrStartsWith = (arr: TermName[], prefix: TermName[]): boolean => {
  for (let i = 0; i < prefix.length; i += 1) {
    if (prefix[i] !== arr[i]) {
      return false;
    }
  }
  return true;
};

export const bufferEquals = (a: Uint8Array | DataView, b: Uint8Array | DataView): boolean => {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  const _a: Uint8Array = a instanceof Uint8Array ? a : new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const _b: Uint8Array = b instanceof Uint8Array ? b : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < _a.length; i += 1) {
    if (_a[i] !== _b[i]) {
      return false;
    }
  }
  return true;
}
