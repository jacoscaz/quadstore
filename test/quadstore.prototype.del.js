
'use strict';

const _ = require('../dist/lib/utils');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.del()', () => {

    it('should delete a quad correctly', async function () {
      const store = this.store;
      const quad = { subject: 's', predicate: 'p', object: 'o', graph: 'c' };
      await store.put(quad);
      const { items: quadsBefore } = await store.get({});
      should(quadsBefore).have.length(1);
      await store.del(quadsBefore[0]);
      const { items: quadsAfter } = await store.get({});
      should(quadsAfter).have.length(0);
    });

  });

};
