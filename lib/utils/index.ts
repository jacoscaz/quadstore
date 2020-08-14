import {TSQuad, TSReadable, TSSimplePattern, TSTermName} from '../types/index.js';
import {EventEmitter} from 'events';
import {nanoid} from './nanoid.js';
import {AsyncIterator, TransformIterator} from 'asynciterator';
import {flatMap} from './flatmap.js';
import {pReduce} from './p-reduce';

export const termNames: TSTermName[] = [
  TSTermName.SUBJECT,
  TSTermName.PREDICATE,
  TSTermName.OBJECT,
  TSTermName.GRAPH,
];

export const isFunction = (f: any): boolean => {
  return typeof(f) === 'function';
};

export const isObject = (o: any): boolean => {
  return typeof(o) === 'object' && o !== null;
};

export const isSimpleObject = (o: any): boolean => {
  return isObject(o) && o.constructor === Object;
};

export const isString = (s: any): boolean => {
  return typeof(s) === 'string';
};

export const isNil = (n: any): boolean => {
  return n === null || n === undefined;
};

export const isArray = Array.isArray;

export const streamToArray = <T>(readStream: TSReadable<T>): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const chunks: T[] = [];
    readStream
      .on('data', (chunk) => { chunks.push(chunk); })
      .on('end', () => { resolve(chunks); })
      .on('error', (err) => { reject(err); });
  });
}

export const isReadableStream = (obj: any): boolean => {
  return isObject(obj)
    && isFunction(obj.on)
    && isFunction(obj.read);
}

export const isAbstractLevelDOWNInstance = (obj: any): boolean => {
  return isObject(obj)
    && isFunction(obj.put)
    && isFunction(obj.del)
    && isFunction(obj.batch);
}

export const isDataFactory = (obj: any): boolean => {
  return (isObject(obj) || isFunction(obj))
    && isFunction(obj.literal)
    && isFunction(obj.defaultGraph)
    && isFunction(obj.blankNode)
    && isFunction(obj.namedNode)
    && isFunction(obj.variable)
    && isFunction(obj.triple)
    && isFunction(obj.quad);
}

export const resolveOnEvent = (emitter: EventEmitter, event: string, rejectOnError: boolean): Promise<any> => {
  return new Promise((resolve, reject) => {
    emitter.on(event, resolve);
    if (rejectOnError) {
      emitter.on('error', reject);
    }
  });
}

export const waitForEvent = resolveOnEvent;

export const genDefaultIndexes = (): TSTermName[][] => {
  return [
    [TSTermName.SUBJECT, TSTermName.PREDICATE, TSTermName.OBJECT, TSTermName.GRAPH],
    [TSTermName.OBJECT, TSTermName.GRAPH, TSTermName.SUBJECT, TSTermName.PREDICATE],
    [TSTermName.GRAPH, TSTermName.SUBJECT, TSTermName.PREDICATE, TSTermName.OBJECT],
    [TSTermName.OBJECT, TSTermName.SUBJECT, TSTermName.PREDICATE, TSTermName.GRAPH],
    [TSTermName.PREDICATE, TSTermName.OBJECT, TSTermName.GRAPH, TSTermName.SUBJECT],
    [TSTermName.GRAPH, TSTermName.PREDICATE, TSTermName.OBJECT, TSTermName.SUBJECT],
  ];
}

export const serializeQuad = (quad: TSQuad): string => {
  return JSON.stringify(quad);
};

export const deserializeQuad = (str: string): TSQuad => {
  return JSON.parse(str);
};

export { nanoid };


class BatchingIterator<T> extends TransformIterator<T, T> {

  constructor(source: AsyncIterator<T>, batchSize: number, onEachBatch: (items: T[]) => Promise<void>) {

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

export const consumeInBatches = async <T>(iterator: AsyncIterator<T>, batchSize: number, onEachBatch: (items: T[]) => Promise<any>) => {
  return new Promise((resolve, reject) => {
    new BatchingIterator(iterator, batchSize, onEachBatch)
      .on('end', resolve)
      .on('error', reject);
  });
};

export const consumeOneByOne = async <T>(iterator: AsyncIterator<T>, onEachItem: (item: T) => Promise<any>) => {
  return new Promise((resolve, reject) => {
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
