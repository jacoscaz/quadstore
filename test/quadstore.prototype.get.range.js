
'use strict';

const _ = require('../dist-cjs/lib/utils');
const should = require('should');

module.exports = () => {

  describe('Match by range', () => {

    it('should match quads by subject [GTE]', async function () {
      const { items: quads } = await this.store.get({ subject: { gte: 's'} });
      should(quads).have.length(5);
    });

    it('should match quads by subject [LTE]', async function () {
      const { items: quads } = await this.store.get({ subject: { lte: 's2'} });
      should(quads).have.length(5);
    });

  });

};
