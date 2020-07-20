"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = 'sOwnPropMN49CEiq-hXvHJdSymlFURTag61GQfuD8YIWz2Zk5xKB7LV30_Abject';
const nanoid = (size = 21) => {
    let id = '';
    while (size--) {
        id += url[Math.random() * 64 | 0];
    }
    return id;
};
exports.default = nanoid;
//# sourceMappingURL=nanoid.js.map