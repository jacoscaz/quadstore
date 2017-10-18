
'use strict';

const _ = require('lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.getByIndex', () => {

    it('Should get quads using a standard index correctly.', async function () {
      const store = this.store;
      const name = 'SPOG';
      const quads = [
        { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0' },
        { subject: 's1', predicate: 'p1', object: 'o1', graph: 'g1' },
        { subject: 's1', predicate: 'p2', object: 'o2', graph: 'g2' },
      ];
      await store.put(quads);
      const foundQuads = await store.getByIndex(name, { gte: 's1', lte: 's1' + store.boundary });
      should(foundQuads).have.length(2);
      should(foundQuads).deepEqual(quads.slice(1));
    });

    it('Should get quads using a custom index correctly.', async function () {
      const store = this.store;
      const name = 'SUBJECT';
      const keygen = quad => quad.date;
      store.registerIndex(name, keygen);
      const todaysDate = '1970-01-01';
      const yesterdaysDate = '1969-12-31';
      const quads = [
        { subject: 's0', predicate: 'p0', object: 'o0', graph: 'g0', date: yesterdaysDate },
        { subject: 's1', predicate: 'p1', object: 'o1', graph: 'g1', date: todaysDate },
        { subject: 's1', predicate: 'p2', object: 'o2', graph: 'g2', date: todaysDate },
      ];
      await store.put(quads);
      const foundQuads = await store.getByIndex(name, { gte: todaysDate, lte: todaysDate + store.boundary });
      should(foundQuads).have.length(2);
      should(foundQuads).deepEqual(quads.slice(1));
    });

  });

};
