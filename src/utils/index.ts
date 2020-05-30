
import { isFunction, isObject } from './lodash';
import {IReadable} from '../types';
import { EventEmitter} from 'events';
import nanoid from './nanoid';

export const wait = (delay: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

export const streamToArray = <T>(readStream: IReadable<T>): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const chunks: T[] = [];
    readStream
      .on('data', (chunk) => { chunks.push(chunk); })
      .on('end', () => { resolve(chunks); })
      .on('error', (err) => { reject(err); });
  });
}

export const streamToString = <T>(readStream: IReadable<T>): Promise<string> => {
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

export const hasAllTerms = (coll: object): boolean => {
  if (typeof(coll) !== 'object') throw new Error('not an object');
  const found: { [key: string]: boolean } = {};
  const terms = Array.isArray(coll) ? coll : Object.keys(coll);
  if (terms.length !== 4) {
    return false;
  }
  for (let t = 0; t < terms.length; t += 1) {
    switch (terms[t]) {
      case 'subject':
      case 'predicate':
      case 'object':
      case 'graph':
        if (found[terms[t]]) {
          return false;
        }
        found[terms[t]] = true;
        break;
      default:
        return false;
    }
  }
  return true;
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
