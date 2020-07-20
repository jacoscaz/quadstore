
'use strict';

const _ = require('../dist-cjs/lib/utils/lodash');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.get()', () => {

    beforeEach(async function () {
      await this.store.put([
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
        { subject: 's2', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's2', predicate: 'p', object: 'o2', graph: 'c' },
        { subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' },
      ]);
    });

    describe('Match by value', () => {

      it('should match quads by subject', async function () {
        const { items: quads } = await this.store.get({ subject: 's' });
        should(quads).have.length(2);
      });

      it('should match quads by predicate', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p' });
        should(quads).have.length(3);
      });

      it('should match quads by object', async function () {
        const { items: quads } = await this.store.get({ object: 'o' });
        should(quads).have.length(2);
      });

      it('should match quads by context', async function () {
        const { items: quads } = await this.store.get({ graph: 'c' });
        should(quads).have.length(3);
      });

      it('should match quads by subject and predicate', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', predicate: 'p' });
        should(quads).have.length(2);
      });

      it('should match quads by subject and object', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', object: 'o' });
        should(quads).have.length(1);
      });

      it('should match quads by subject and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', graph: 'c' });
        should(quads).have.length(2);
      });

      it('should match quads by predicate and object', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p', object: 'o' });
        should(quads).have.length(2);
      });

      it('should match quads by predicate and context', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p', graph: 'c' });
        should(quads).have.length(3);
      });

      it('should match quads by object and context', async function () {
        const { items: quads } = await this.store.get({ object: 'o2', graph: 'c2' });
        should(quads).have.length(2);
      });

      it('should match quads by subject, predicate and object', async function () {
        const { items: quads } = await this.store.get({ subject: 's', predicate: 'p2', object: 'o2' });
        should(quads).have.length(1);
      });

      it('should match quads by subject, predicate and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's', predicate: 'p2', graph: 'c2' });
        should(quads).have.length(1);
      });

      it('should match quads by subject, object and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's', object: 'o2', graph: 'c2' });
        should(quads).have.length(1);
      });

      it('should match quads by predicate, object and context', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p2', object: 'o2', graph: 'c2' });
        should(quads).have.length(2);
      });

      it('should match quads by subject, predicate, object and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' });
        should(quads).have.length(1);
      });

    });

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

  });

};
