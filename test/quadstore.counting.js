
'use strict';

const _ = require('../dist-cjs/lib/utils');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.getApproximateSize()', () => {

    beforeEach(async function () {
      const genQuad = (i) => ({
        subject: `s${i}`,
        predicate: `p${i}`,
        object: `o${i}`,
        graph: `c${i}`,
      });
      for (let i = 0; i < 5000; i += 1) {
        await this.store.put(genQuad(i));
      }
    });

    describe('Count by value', () => {

      it('should count quads by subject', async function () {
        const count = await this.store.getApproximateSize({ subject: { lte: 's500' } });
        // TODO: check count
      });

    });
  });

};
