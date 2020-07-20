"use strict";
/*
 * Non-secure implementation of the "nanoid" unique string ID generator
 * by Andrey Sitnik <andrey@sitnik.ru>, released under MIT license.
 *
 * @see https://github.com/ai/nanoid
 * @see https://github.com/ai/nanoid/blob/14612714d8bf719987c9e47a78a682e342f56788/non-secure/index.js
 */
exports.__esModule = true;
var url = 'sOwnPropMN49CEiq-hXvHJdSymlFURTag61GQfuD8YIWz2Zk5xKB7LV30_Abject';
var nanoid = function (size) {
    if (size === void 0) { size = 21; }
    var id = '';
    while (size--) {
        id += url[Math.random() * 64 | 0];
    }
    return id;
};
exports["default"] = nanoid;
