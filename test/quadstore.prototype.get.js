
'use strict';

const _ = require('../dist/lib/utils');
const should = require('should');

module.exports = () => {

  describe('Quadstore.prototype.get()', () => {

    beforeEach(async function () {
      const { dataFactory } = this;
      this.quads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://c'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://c2'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://c'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://c'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://c2'),
        ),
      ];
      await this.store.multiPut(this.quads);
    });

    it('should match quads by subject', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
      });
      should(quads).be.equalToQuadArray(this.quads.slice(0, 2), this.store);
    });

    it('should match quads by predicate', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)], this.store);
    });

    it('should match quads by object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        object: dataFactory.namedNode('ex://o'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], this.quads[2]], this.store);
    });

    it('should match quads by context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        graph: dataFactory.namedNode('ex://c') });
      should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)], this.store);
    });

    it('should match quads by subject and predicate', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        predicate: dataFactory.namedNode('ex://p'),
      });
      should(quads).be.equalToQuadArray([this.quads[2], this.quads[3]], this.store);
    });

    it('should match quads by subject and object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        object: dataFactory.namedNode('ex://o'),
      });
      should(quads).be.equalToQuadArray([this.quads[2]], this.store);
    });

    it('should match quads by subject and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        graph: dataFactory.namedNode('ex://c'),
      });
      should(quads).be.equalToQuadArray([this.quads[2], this.quads[3]], this.store);
    });

    it('should match quads by predicate and object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p'),
        object: dataFactory.namedNode('ex://o'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], this.quads[2]], this.store);
    });

    it('should match quads by predicate and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p'),
        graph: dataFactory.namedNode('ex://c'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)], this.store);
    });

    it('should match quads by object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1], this.quads[4]], this.store);
    });

    it('should match quads by subject, predicate and object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
        predicate: dataFactory.namedNode('ex://p2'),
        object: dataFactory.namedNode('ex://o2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1]], this.store);
    });

    it('should match quads by subject, predicate and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
        predicate: dataFactory.namedNode('ex://p2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1]], this.store);
    });

    it('should match quads by subject, object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1]], this.store);
    });

    it('should match quads by predicate, object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p2'),
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1], this.quads[4]], this.store);
    });

    it('should match quads by subject, predicate, object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        predicate: dataFactory.namedNode('ex://p2'),
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[4]], this.store);
    });

  });

};
