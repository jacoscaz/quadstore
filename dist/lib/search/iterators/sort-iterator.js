"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const js_sorted_set_1 = __importDefault(require("js-sorted-set"));
const asynciterator_1 = __importDefault(require("asynciterator"));
class SortedSetIterator extends asynciterator_1.default.BufferedIterator {
    constructor(set) {
        super();
        let value;
        let iterator = set.beginIterator();
        this._read = (count, done) => {
            do {
                value = iterator.value();
                if (value === null) {
                    this.close();
                    return done();
                }
                this._push(value);
                iterator = iterator.next();
                count -= 1;
            } while (count > 0);
            done();
        };
    }
}
class SortIterator extends asynciterator_1.default.TransformIterator {
    constructor(source, comparator) {
        super();
        const set = new js_sorted_set_1.default({ comparator });
        source.on('data', (item) => {
            set.insert(item);
        });
        source.on('end', () => {
            this.source = new SortedSetIterator(set);
        });
    }
}
exports.default = SortIterator;
//# sourceMappingURL=sort-iterator.js.map