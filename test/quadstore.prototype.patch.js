
'use strict';

const _ = require('../dist-cjs/lib/utils');
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
      await store.multiPut(quadsArray);
      await store.multiPatch(oldQuads, newQuads);
      const { items: quads } = await store.get({});
      newQuads.sort(store.getQuadComparator());
      quads.sort(store.getQuadComparator());
      should(quads).have.length(expected.length);
      should(quads).be.deepEqual(expected.sort(store.getQuadComparator()));
    });

  });

};
