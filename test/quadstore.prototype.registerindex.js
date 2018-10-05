
'use strict';

const _ = require('../lib/lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.registerIndex()', () => {

    it('Should register a new index correctly.', async function () {
      const store = this.store;
      const name = 'SUBJECT';
      const keygen = quad => quad.subject;
      store.registerIndex(name, keygen);
      const index = store._getIndex(name);
      should(name).equal(index.name);
      should(keygen).equal(index.keygen);
    });

  });

};
