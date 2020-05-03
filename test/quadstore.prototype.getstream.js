
'use strict';

const _ = require('../lib/utils/lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.getStream()', () => {

    beforeEach(async function () {
      await this.store.put([
        {subject: 's', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's', predicate: 'p2', object: 'o2', graph: 'c2'},
        {subject: 's2', predicate: 'p', object: 'o', graph: 'c'},
        {subject: 's2', predicate: 'p', object: 'o2', graph: 'c'},
        {subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2'},
      ]);
    });

    describe('Meta', () => {

      it('should match quads by subject', function (cb) {
        const iterator = this.store.getStream({subject: 's'});
        iterator.getProperty('meta', (meta) => {
          iterator.destroy();
          should(iterator.done).equal(true);
          should(meta).be.an.Object();
          should(meta.sorting).deepEqual(['subject', 'predicate', 'object', 'graph']);
          should(meta.approximateCount).be.a.Number();
          cb();
        });
      });

    });

  });

}
