
import { isFunction, isObject } from './lodash';
import {TSReadable, TSTermName} from '../types';
import { EventEmitter} from 'events';
import nanoid from './nanoid';

export const wait = (delay: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

export const termNames: TSTermName[] = ['subject', 'predicate', 'object', 'graph'];

export const streamToArray = <T>(readStream: TSReadable<T>): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const chunks: T[] = [];
    readStream
      .on('data', (chunk) => { chunks.push(chunk); })
      .on('end', () => { resolve(chunks); })
      .on('error', (err) => { reject(err); });
  });
}

export const streamToString = <T>(readStream: TSReadable<T>): Promise<string> => {
  return new Promise((resolve, reject) => {
    let buffer = '';
    readStream
      .on('data', (chunk) => {
        // @ts-ignore
        buffer += chunk.toString();
      })
      .on('end', () => {
        resolve(buffer);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

export const isReadableStream = (obj: any): boolean => {
  return isObject(obj)
    && isFunction(obj.on)
    && isFunction(obj.read);
}

export const isPromise = (obj: any): boolean => {
  return isObject(obj)
    && isFunction(obj.then);
}


export const isAbstractLevelDownClass = (obj: any): boolean => {
  return isFunction(obj)
    && isFunction(obj.prototype.batch)
    && isFunction(obj.prototype.iterator);
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

export const wrapError = (err: Error, message: string): Error => {
  const wrapperError = new Error(message);
  wrapperError.stack += '\nCaused by:' + err.stack;
  return wrapperError;
}

export const defineReadOnlyProperty = (obj: object, key: string, value: any): void => {
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    enumerable: true,
    configurable: true
  });
}

export const noop = () => {};

export const hasAllTerms = (coll: any): boolean => {
  return typeof(coll) === 'object'
    && 'subject' in coll
    && 'predicate' in coll
    && 'object' in coll
    && 'graph' in coll;
}

export const genDefaultIndexes = () => {
  return [
    ['subject', 'predicate', 'object', 'graph'],
    ['object', 'graph', 'subject', 'predicate'],
    ['graph', 'subject', 'predicate', 'object'],
    ['object', 'subject', 'predicate', 'graph'],
    ['predicate', 'object', 'graph', 'subject'],
    ['graph', 'predicate', 'object', 'subject'],
    // ['predicate', 'object', 'subject', 'graph'], // TODO remove
  ];
}

export { nanoid };
