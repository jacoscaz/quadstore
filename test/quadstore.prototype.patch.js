
'use strict';

const _ = require('../lib/utils/lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.patch()', () => {

    const quadsSamples = [
      { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
      { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
      { subject: 's2', predicate: 'p', object: 'o', graph: 'c' },
      { subject: 's2', predicate: 'p', object: 'o2', graph: 'c' },
      { subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' },
    ];

    it('should delete old quads and add new ones', async function () {
      const store = this.store;
      const quadsArray = quadsSamples;
      const oldQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
      ];
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', graph: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', graph: 'c1' },
      ];
      const expected = quadsSamples.slice(2).concat(newQuads);
      await store.put(quadsArray);
      await store.patch(oldQuads, newQuads);
      const quads = await store.get({});
      newQuads.sort(store._createQuadComparator());
      quads.sort(store._createQuadComparator());
      should(quads).have.length(expected.length);
      should(quads).be.deepEqual(expected.sort(store._createQuadComparator()));
    });

    it('should delete matching quads and do an insert (cb)', async function () {
      const store = this.store;
      const quadsArray = quadsSamples;
      const newQuads = [
        { subject: 's3', predicate: 'p3', object: 'o2', graph: 'c' },
        { subject: 's4', predicate: 'p3', object: 'o2', graph: 'c1' },
      ];
      await store.put(quadsArray);
      await store.patch({ subject: 's2' }, newQuads);
      const quads = await store.get({});
      newQuads.sort(store._createQuadComparator());
      quads.sort(store._createQuadComparator());
      should(quads).have.length(4);
      should(quads).be.deepEqual(quadsSamples.slice(0, 2).concat(newQuads));
    });

  });

};
