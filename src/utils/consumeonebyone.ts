
import { TSReadable } from '../types/index.js';

export const consumeOneByOne = async <T>(iterator: TSReadable<T>, onEachItem: (item: T) => any) => {
  return new Promise<void>((resolve, reject) => {
    let item;
    let ended = false;
    let looping = false;
    const loop = () => {
      looping = true;
      if ((item = iterator.read()) !== null) {
        Promise.resolve(onEachItem(item))
          .then(loop)
          .catch(onError);
        return;
      }
      looping = false;
      if (ended) {
        resolve();
      }
    };
    const onError = (err: Error) => {
      reject(err);
      cleanup();
    };
    const onEnd = () => {
      ended = true;
      if (!looping) {
        resolve();
      }
      cleanup();
    };
    const onReadable = () => {
      if (!looping) {
        loop();
      }
    };
    const cleanup = () => {
      iterator.removeListener('end', onEnd);
      iterator.removeListener('error', onError);
      iterator.removeListener('readable', onReadable);
      if (typeof iterator.destroy === 'function') {
        iterator.destroy();
      }
    };
    iterator.on('end', onEnd);
    iterator.on('error', onError);
    iterator.on('readable', onReadable);
    // readable might be undefined in older versions of userland readable-stream
    if (iterator.readable !== false) {
      loop();
    }
  });
};
