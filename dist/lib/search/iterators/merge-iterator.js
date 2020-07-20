"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const asynciterator_1 = __importDefault(require("asynciterator"));
class MergeIterator extends asynciterator_1.default.BufferedIterator {
    constructor(a, b, compare, push) {
        super();
        let isReading = false;
        let isDestroyed = false;
        let destroyDone = null;
        let destroyCause = null;
        let readMore = 0;
        let readDone = null;
        let readA = true;
        let aEnded = false;
        let aCurrent = null;
        let aWaiting = false;
        let readB = true;
        let bEnded = false;
        let bCurrent = null;
        let bWaiting = false;
        let aOnEnd;
        let bOnEnd;
        const cleanup = () => {
            a.removeListener('readable', loop);
            a.removeListener('end', aOnEnd);
            b.removeListener('readable', loop);
            b.removeListener('end', bOnEnd);
            isReading = false;
            aWaiting = false;
            bWaiting = false;
            if (!a.done && !a.ended) {
                a.destroy(destroyCause);
            }
            if (!b.done && !b.ended) {
                b.destroy(destroyCause);
            }
            if (readDone) {
                readDone();
                readDone = null;
            }
            if (!this.ended) {
                this.close();
            }
            if (destroyDone) {
                destroyDone();
                destroyDone = null;
            }
        };
        aOnEnd = () => {
            aEnded = true;
            if (isReading && (aWaiting || bWaiting)) {
                loop();
            }
        };
        a.once('end', aOnEnd);
        bOnEnd = () => {
            bEnded = true;
            if (isReading && (bWaiting || aWaiting))
                loop();
        };
        b.once('end', bOnEnd);
        const loop = () => {
            aWaiting = false;
            bWaiting = false;
            if (isDestroyed) {
                return cleanup();
            }
            if (readA) {
                aCurrent = a.read();
                readA = false;
            }
            if (readB) {
                bCurrent = b.read();
                readB = false;
            }
            if (aCurrent === null) {
                if (a.ended || a.done) {
                    return cleanup();
                }
                readA = true;
                if (!a.readable) {
                    aWaiting = true;
                    return a.once('readable', loop);
                }
                return loop();
            }
            if (bCurrent === null) {
                if (b.ended || b.done) {
                    return cleanup();
                }
                readB = true;
                if (!b.readable) {
                    bWaiting = true;
                    return b.once('readable', loop);
                }
                return loop();
            }
            const result = compare(aCurrent, bCurrent);
            if (result < 0) {
                readA = true;
                return loop();
            }
            if (result > 0) {
                readB = true;
                return loop();
            }
            this._push(push(aCurrent, bCurrent));
            readMore -= 1;
            readA = true;
            readB = true;
            if (readMore === 0) {
                isReading = false;
                const _readDone = readDone;
                readDone = null;
                return _readDone();
            }
            loop();
        };
        this._read = (count, done) => {
            if (isReading) {
                return;
            }
            if (isDestroyed) {
                return;
            }
            isReading = true;
            readMore = count;
            readDone = done;
            loop();
        };
        this._destroy = (cause, done) => {
            isDestroyed = true;
            destroyDone = done;
            destroyCause = cause;
            cleanup();
        };
    }
}
exports.default = MergeIterator;
//# sourceMappingURL=merge-iterator.js.map