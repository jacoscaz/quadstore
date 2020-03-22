/*
 * Non-secure implementation of the "nanoid" unique string ID generator
 * by Andrey Sitnik <andrey@sitnik.ru>, released under MIT license.
 *
 * @see https://github.com/ai/nanoid
 * @see https://github.com/ai/nanoid/blob/14612714d8bf719987c9e47a78a682e342f56788/non-secure/index.js
 */

var url = 'sOwnPropMN49CEiq-hXvHJdSymlFURTag61GQfuD8YIWz2Zk5xKB7LV30_Abject';

const nanoid = (size = 21) => {
  let id = '';
  while (size--) {
    id += url[Math.random() * 64 | 0];
  }
  return id;
};

module.exports = nanoid;
