
const AsyncIterator = require('asynciterator');

class NestedLoopJoinIterator extends AsyncIterator.BufferedIterator {

  constructor(outerIterator, getInnerIterator, mergeItems) {

    super();

    let isReading = false;
    let waitingOnOuter = false;
    let waitingOnInner = false;
    let readDone = null;
    let readCount = 0;

    let innerIterator = null;

    let outerItem = null;
    let innerItem = null;

    let outerEnded = false;

    outerIterator.once('end', () => {
      outerEnded = true;
      if (waitingOnOuter) {
        outerIterator.removeListener('readable', loop);
        readDone();
        this.close();
      }
    });

    const loop = () => {

      waitingOnOuter = false;
      waitingOnInner = false;

      if (readCount === 0) {
        readDone();
        isReading = false;
        readDone = null;
        return;
      }

      if (outerItem === null) {
        outerItem = outerIterator.read();
        if (outerItem === null) {
          waitingOnOuter = true;
          outerIterator.once('readable', loop);
          return;
        }
        return getInnerIterator(outerItem)
          .then((_innerIterator) => {
            innerIterator = _innerIterator;
            innerIterator.once('end', () => {
              innerItem = null;
              outerItem = null;
              if (waitingOnInner) {
                innerIterator.removeListener('readable', loop);
                innerIterator = null;
                if (outerEnded) {
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
        innerItem = innerIterator.read();
        if (innerItem === null) {
          waitingOnInner = true;
          innerIterator.once('readable', loop);
          return;
        }
      }

      this._push(mergeItems(outerItem, innerItem));
      innerItem = null;
      readCount -= 1;
      loop();

    };

    this._read = (count, done) => {
      isReading = true;
      readDone = done;
      readCount = count;
      loop();
    };

  }

}

module.exports = NestedLoopJoinIterator;
