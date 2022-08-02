
import type { EventEmitter } from 'events';
import type { AbstractLevel } from 'abstract-level';
import type { TSReadable, TermName } from '../types';

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

export const pFromCallback = <T>(fn: (cb: (err: Error|undefined|null, val?: T) => void) => void): Promise<T|undefined> => {
  return new Promise((resolve, reject) => {
    fn((err: Error|undefined|null, val?: T) => {
      err ? reject(err) : resolve(val);
    });
  });
};

export const arrStartsWith = (arr: TermName[], prefix: TermName[]): boolean => {
  for (let i = 0; i < prefix.length; i += 1) {
    if (prefix[i] !== arr[i]) {
      return false;
    }
  }
  return true;
};
