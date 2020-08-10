
'use strict';

const _ = require('../dist/lib/utils');
const should = require('should');

module.exports = () => {

  describe('QuadStore.prototype.get()', () => {

    beforeEach(async function () {
      this.quads = [
        { subject: 's', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's', predicate: 'p2', object: 'o2', graph: 'c2' },
        { subject: 's2', predicate: 'p', object: 'o', graph: 'c' },
        { subject: 's2', predicate: 'p', object: 'o2', graph: 'c' },
        { subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' },
      ];
      await this.store.multiPut(this.quads);
    });

    describe('Match by value', () => {

      it('should match quads by subject', async function () {
        const { items: quads } = await this.store.get({ subject: 's' });
        should(quads).be.equalToQuadArray(this.quads.slice(0, 2), this.store);
      });

      it('should match quads by predicate', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p' });
        should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)], this.store);
      });

      it('should match quads by object', async function () {
        const { items: quads } = await this.store.get({ object: 'o' });
        should(quads).be.equalToQuadArray([this.quads[0], this.quads[2]], this.store);
      });

      it('should match quads by context', async function () {
        const { items: quads } = await this.store.get({ graph: 'c' });
        should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)], this.store);
      });

      it('should match quads by subject and predicate', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', predicate: 'p' });
        should(quads).be.equalToQuadArray([this.quads[2], this.quads[3]], this.store);
      });

      it('should match quads by subject and object', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', object: 'o' });
        should(quads).be.equalToQuadArray([this.quads[2]], this.store);
      });

      it('should match quads by subject and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', graph: 'c' });
        should(quads).be.equalToQuadArray([this.quads[2], this.quads[3]], this.store);
      });

      it('should match quads by predicate and object', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p', object: 'o' });
        should(quads).be.equalToQuadArray([this.quads[0], this.quads[2]], this.store);
      });

      it('should match quads by predicate and context', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p', graph: 'c' });
        should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)], this.store);
      });

      it('should match quads by object and context', async function () {
        const { items: quads } = await this.store.get({ object: 'o2', graph: 'c2' });
        should(quads).be.equalToQuadArray([this.quads[1], this.quads[4]], this.store);
      });

      it('should match quads by subject, predicate and object', async function () {
        const { items: quads } = await this.store.get({ subject: 's', predicate: 'p2', object: 'o2' });
        should(quads).be.equalToQuadArray([this.quads[1]], this.store);
      });

      it('should match quads by subject, predicate and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's', predicate: 'p2', graph: 'c2' });
        should(quads).be.equalToQuadArray([this.quads[1]], this.store);
      });

      it('should match quads by subject, object and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's', object: 'o2', graph: 'c2' });
        should(quads).be.equalToQuadArray([this.quads[1]], this.store);
      });

      it('should match quads by predicate, object and context', async function () {
        const { items: quads } = await this.store.get({ predicate: 'p2', object: 'o2', graph: 'c2' });
        should(quads).be.equalToQuadArray([this.quads[1], this.quads[4]], this.store);
      });

      it('should match quads by subject, predicate, object and context', async function () {
        const { items: quads } = await this.store.get({ subject: 's2', predicate: 'p2', object: 'o2', graph: 'c2' });
        should(quads).be.equalToQuadArray([this.quads[4]], this.store);
      });

    });

    require('./quadstore.prototype.get.range')();

  });

};
