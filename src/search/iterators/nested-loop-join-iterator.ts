
import ai from 'asynciterator';

class NestedLoopJoinIterator<T> extends ai.BufferedIterator<T> {

  constructor(outerIterator: ai.AsyncIterator<T>, getInnerIterator: (t: T) => Promise<ai.AsyncIterator<T>>, mergeItems: (o: T, i: T) => T) {

    super();

    let isReading = false;
    let waitingOnOuter = false;
    let waitingOnInner = false;
    let readDone: (() => void) | null = null;
    let readCount = 0;

    let innerIterator: ai.AsyncIterator<T> | null = null;

    let outerItem: T | null = null;
    let innerItem: T | null = null;

    let outerEnded = false;

    // @ts-ignore
    outerIterator.once('end', () => {
      outerEnded = true;
      if (waitingOnOuter) {
        // @ts-ignore
        outerIterator.removeListener('readable', loop);
        // @ts-ignore
        readDone();
        this.close();
      }
    });

    const loop = () => {

      waitingOnOuter = false;
      waitingOnInner = false;

      if (readCount === 0) {
        // @ts-ignore
        readDone();
        isReading = false;
        readDone = null;
        return;
      }

      if (outerItem === null) {
        // @ts-ignore
        outerItem = outerIterator.read();
        if (outerItem === null) {
          waitingOnOuter = true;
          // @ts-ignore
          outerIterator.once('readable', loop);
          return;
        }
        return getInnerIterator(outerItem)
          .then((_innerIterator) => {
            innerIterator = _innerIterator;
            // @ts-ignore
            innerIterator.once('end', () => {
              innerItem = null;
              outerItem = null;
              if (waitingOnInner) {
                // @ts-ignore
                innerIterator.removeListener('readable', loop);
                innerIterator = null;
                if (outerEnded) {
                  // @ts-ignore
                  readDone();
                  this.close();
                } else {
                  loop();
                }
              }
            });
            loop();
          })
          .catch((err) => {
            console.log('INNER ITERATOR ERROR', err);
            outerItem = null;
            loop();
          });
      }

      if (innerItem === null) {
        // @ts-ignore
        innerItem = innerIterator.read();
        if (innerItem === null) {
          waitingOnInner = true;
          // @ts-ignore
          innerIterator.once('readable', loop);
          return;
        }
      }

      this._push(mergeItems(outerItem, innerItem));
      innerItem = null;
      readCount -= 1;
      loop();

    };

    this._read = (count: number, done: () => void) => {
      isReading = true;
      readDone = done;
      readCount = count;
      loop();
    };

  }

}

export default NestedLoopJoinIterator;
