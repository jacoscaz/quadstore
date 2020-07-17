"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const asynciterator_1 = __importDefault(require("asynciterator"));
class MergeIterator extends asynciterator_1.default.BufferedIterator {
    constructor(a, b, compare, push) {
        super();
        /** True if we're looping */
        let isReading = false;
        /** True if ".destroy()" has been called */
        let isDestroyed = false;
        /** Callback passed to _destroy() */
        let destroyDone = null;
        /** Cause passed to _destroy() */
        let destroyCause = null;
        /** Number of elements left to push */
        let readMore = 0;
        /** _read() Callback */
        let readDone = null;
        /** Whether we have to read from a at the next iteration */
        let readA = true;
        /** Whether a has ended */
        let aEnded = false;
        /** Latest item read from a */
        let aCurrent = null;
        /** Whether we're waiting for a "readable" event on a */
        let aWaiting = false;
        /** Whether we have to read from b at the next iteration */
        let readB = true;
        /** Whether b has ended */
        let bEnded = false;
        /** Latest item read from b */
        let bCurrent = null;
        /** Whether we're waiting for a "readable" event on b */
        let bWaiting = false;
        /** end event handler for a */
        let aOnEnd;
        /** end event handler for b */
        let bOnEnd;
        const cleanup = () => {
            a.removeListener('readable', loop);
            a.removeListener('end', aOnEnd);
            b.removeListener('readable', loop);
            b.removeListener('end', bOnEnd);
            isReading = false;
            aWaiting = false;
            bWaiting = false;
            // @ts-ignore
            if (!a.done && !a.ended) {
                // @ts-ignore
                a.destroy(destroyCause);
            }
            // @ts-ignore
            if (!b.done && !b.ended) {
                // @ts-ignore
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
        // If a ends as we're waiting for a "readable" event, we need to manually
        // call the next iteration of the loop.
        aOnEnd = () => {
            aEnded = true;
            if (isReading && (aWaiting || bWaiting)) {
                loop();
            }
        };
        a.once('end', aOnEnd);
        // If b ends as we're waiting for a "readable" event, we need to manually
        // call the next iteration of the loop.
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
                // @ts-ignore
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
                // @ts-ignore
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
                // @ts-ignore
                return _readDone();
            }
            loop();
        };
        this._read = (count, done) => {
            // If we're already looping, do not start another loop. As long as we
            // call the "done" callback correctly, this should never happen.
            if (isReading) {
                return;
            }
            // If this iterator has been destroyed, do not start looping in case the
            // _read() method is somehow called. This should never happen.
            if (isDestroyed) {
                return;
            }
            // Start looping.
            isReading = true;
            readMore = count;
            readDone = done;
            loop();
        };
        // @ts-ignore
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