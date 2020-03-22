
'use strict';

const _ = require('../lib/utils/lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.put()', () => {

    it('should store a single quad correctly (as object) (cb)',  async function () {
      const store = this.store;
      const newQuad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      await store.put(newQuad);
      const foundQuads = await store.get({});
      should(foundQuads).have.length(1);
      should(foundQuads[0]).deepEqual(newQuad);
    });

    it('should store a single quad correctly (as array) (promise)', async function () {
      const store = this.store;
      const newQuads = [{ subject: 's', predicate: 'p', object: 'o', graph: 'c' }];
      await store.put(newQuads);
      const foundQuads = await store.get({});
      should(foundQuads).have.length(1);
      should(foundQuads[0]).deepEqual(newQuads[0]);
    });

    it('should store multiple quads correctly (cb)',  async function () {
      const store = this.store;
      const newQuads = [
        { subject: 's0', predicate: 'p0', object: 'o0', graph: 'c0' },
        { subject: 's1', predicate: 'p1', object: 'o1', graph: 'c1' }
      ];
      await store.put(newQuads);
      const foundQuads = await store.get({});
      should(foundQuads).have.length(2);
      should(foundQuads[0]).deepEqual(newQuads[0]);
      should(foundQuads[1]).deepEqual(newQuads[1]);
    });

    it('should store multiple quads correctly (promise)', async function () {
      const store = this.store;
      const newQuads = [
        { subject: 's0', predicate: 'p0', object: 'o0', graph: 'c0' },
        { subject: 's1', predicate: 'p1', object: 'o1', graph: 'c1' }
      ];
      await store.put(newQuads);
      const foundQuads = await store.get({});
      should(foundQuads).have.length(2);
      should(foundQuads[0]).deepEqual(newQuads[0]);
      should(foundQuads[1]).deepEqual(newQuads[1]);
    });

    it('should not duplicate quads (cb)',  async function () {
      const store = this.store;
      const newQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' }
      ];
      await store.put(newQuads);
      const foundQuads = await store.get({});
      should(foundQuads).have.length(1);
      should(foundQuads[0]).deepEqual(newQuads[0]);
    });

    it('should not duplicate quads (promise)', async function () {
      const store = this.store;
      const newQuads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' }
      ];
      await store.put(newQuads);
      const foundQuads = await store.get({});
      should(foundQuads).have.length(1);
      should(foundQuads[0]).deepEqual(newQuads[0]);
    });

  });

};
