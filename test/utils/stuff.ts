
import type { AsyncIterator } from 'asynciterator';

export const iteratorToArray = <T>(iterator: AsyncIterator<T>): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const arr: T[] = [];
    iterator.on('data', (item: T) => {
      arr.push(item);
    });
    iterator.on('end', () => {
      resolve(arr);
    });
  });
};

export const delayIterator = <T>(iterator: AsyncIterator<T>, maxDelay = 5): AsyncIterator<T> => {
  return iterator.transform({ transform: (item, done, push) => {
    setTimeout(() => {
      push(item);
      done();
    }, Math.round(Math.random() * maxDelay));
  }});
};

export const equalsUint8Array = (a: Uint8Array, b: Uint8Array) => {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
