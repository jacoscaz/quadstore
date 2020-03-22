
'use strict';

const _ = require('../lib/utils/lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.del()', () => {

    it('should delete a quad correctly', async function () {
      const store = this.store;
      const quad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      await store.put(quad);
      const quadsBefore = await store.get({});
      should(quadsBefore).have.length(1);
      await store.del(quadsBefore[0]);
      const quadsAfter = await store.get({});
      should(quadsAfter).have.length(0);
    });

    it('should delete matching quads correctly', async function () {
      const store = this.store;
      const quadsArray = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
        { subject: 's2', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's2', predicate: 'p', object: 'o2', graph: 'c' },
        { subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' },
      ];
      await store.put(quadsArray);
      await store.del({ subject: 's2' });
      const quads = await store.get({});
      quads.sort(store._createQuadComparator());
      should(quads).have.length(2);
      should(quads).be.deepEqual(quadsArray.slice(0, 2));
    });

  });

};
