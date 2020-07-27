
import {TSReadable, TSTermName} from '../types/index.js';
import { EventEmitter} from 'events';
import {nanoid} from './nanoid.js';

export const termNames: TSTermName[] = ['subject', 'predicate', 'object', 'graph'];

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
    ['subject', 'predicate', 'object', 'graph'],
    ['object', 'graph', 'subject', 'predicate'],
    ['graph', 'subject', 'predicate', 'object'],
    ['object', 'subject', 'predicate', 'graph'],
    ['predicate', 'object', 'graph', 'subject'],
    ['graph', 'predicate', 'object', 'subject'],
  ];
}

export { nanoid };
