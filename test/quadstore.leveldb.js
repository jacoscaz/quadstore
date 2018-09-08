
'use strict';

const utils = require('../lib/utils');
const should = require('should');

function quadToPartialKey(index, store, quad) {
  let key = [index];
  for (const t of index.split('')) {
    switch (t) {
      case 'S': key.push(quad.subject); break;
      case 'P': key.push(quad.predicate); break;
      case 'O': key.push(quad.object); break;
      case 'G': key.push(quad[store._contextKey]); break;
      default: throw new Error(`Bad index ${index}`);
    }
  }
  return key.join(store.separator);
}

module.exports = () => {

  describe('Quad serialization', () => {

    beforeEach(async function () {
      this.quad = {subject: 's1', predicate: 'p1', object: 'o1', graph: 'g1'};
      await this.store.put(this.quad);
    });

    ['SPOG', 'POG', 'OGS', 'GSP', 'GP', 'OS'].forEach(function (index) {

      it(`Should store quads using the ${index} index`,  async function () {
        const pair = (await utils.streamToArray(this.store._db.createReadStream({
          gte: `${index}${this.store.separator}`,
          lte: `${index}${this.store.boundary}`
        })))[0];
        should(pair.key.indexOf(quadToPartialKey(index, this.store, this.quad))).equal(0);
        should(pair.value).deepEqual(this.quad);
      });

    });

  });

};
