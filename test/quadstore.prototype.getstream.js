
'use strict';

const _ = require('../dist/cjs/lib/utils');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.getStream()', () => {

    beforeEach(async function () {
      await this.store.multiPut([
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's', predicate: 'p2', object: 'o2', graph: 'c2'},
        {subject: 's2', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p', object: 'o2', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'},
      ]);
    });

  });

}
