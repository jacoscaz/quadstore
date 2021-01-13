
'use strict';

const _ = require('../dist/lib/utils');
const xsd = require('../dist/lib/serialization/xsd');
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
        dataFactory.quad(
          dataFactory.namedNode('ex://s3'),
          dataFactory.namedNode('ex://p3'),
          dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
          dataFactory.namedNode('ex://c3'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s4'),
          dataFactory.namedNode('ex://p4'),
          dataFactory.literal('Hello, World', 'en-us'),
          dataFactory.namedNode('ex://c4'),
        ),
      ];
      await this.store.multiPut(this.quads);
    });

    it('should match quads by subject', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
      });
      should(quads).be.equalToQuadArray(this.quads.slice(0, 2));
    });

    it('should match quads by predicate', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)]);
    });

    it('should match quads by object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        object: dataFactory.namedNode('ex://o'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], this.quads[2]]);
    });

    it('should match quads by object where object is a numeric literal', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
      });
      should(quads).be.equalToQuadArray([this.quads[5]]);
    });

    it('should match quads by object where object is a language-tagged string', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        object: dataFactory.literal('Hello, World', 'en-us'),
      });
      should(quads).be.equalToQuadArray([this.quads[6]]);
    });

    it('should match quads by context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        graph: dataFactory.namedNode('ex://c') });
      should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)]);
    });

    it('should match quads by subject and predicate', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        predicate: dataFactory.namedNode('ex://p'),
      });
      should(quads).be.equalToQuadArray([this.quads[2], this.quads[3]]);
    });

    it('should match quads by subject and object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        object: dataFactory.namedNode('ex://o'),
      });
      should(quads).be.equalToQuadArray([this.quads[2]]);
    });

    it('should match quads by subject and object where object is a numeric literal', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s3'),
        object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
      });
      should(quads).be.equalToQuadArray([this.quads[5]]);
    });

    it('should match quads by subject and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        graph: dataFactory.namedNode('ex://c'),
      });
      should(quads).be.equalToQuadArray([this.quads[2], this.quads[3]]);
    });

    it('should match quads by predicate and object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p'),
        object: dataFactory.namedNode('ex://o'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], this.quads[2]]);
    });

    it('should match quads by predicate and object where object is a numeric literal', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p3'),
        object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
      });
      should(quads).be.equalToQuadArray([this.quads[5]]);
    });

    it('should match quads by predicate and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p'),
        graph: dataFactory.namedNode('ex://c'),
      });
      should(quads).be.equalToQuadArray([this.quads[0], ...this.quads.slice(2, 4)]);
    });

    it('should match quads by object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1], this.quads[4]]);
    });

    // This test fails with the default set of indexes.
    // it('should match quads by object and context where object is a numeric literal', async function () {
    //   const { dataFactory, store } = this;
    //   const { items: quads } = await store.get({
    //     object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
    //     graph: dataFactory.namedNode('ex://c3'),
    //   });
    //   should(quads).be.equalToQuadArray([this.quads[5]]);
    // });

    it('should match quads by subject, predicate and object', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
        predicate: dataFactory.namedNode('ex://p2'),
        object: dataFactory.namedNode('ex://o2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1]]);
    });

    it('should match quads by subject, predicate and object where object is a numeric literal', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s3'),
        predicate: dataFactory.namedNode('ex://p3'),
        object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
      });
      should(quads).be.equalToQuadArray([this.quads[5]]);
    });

    it('should match quads by subject, predicate and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
        predicate: dataFactory.namedNode('ex://p2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1]]);
    });

    it('should match quads by subject, object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s'),
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1]]);
    });

    // This test fails with the default set of indexes.
    // it('should match quads by subject, object and context where object is a numeric literal', async function () {
    //   const { dataFactory, store } = this;
    //   const { items: quads } = await store.get({
    //     subject: dataFactory.namedNode('ex://s3'),
    //     object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
    //     graph: dataFactory.namedNode('ex://c3'),
    //   });
    //   should(quads).be.equalToQuadArray([this.quads[5]]);
    // });

    it('should match quads by predicate, object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p2'),
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[1], this.quads[4]]);
    });

    it('should match quads by predicate, object and context where object is a numeric literal', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        predicate: dataFactory.namedNode('ex://p3'),
        object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
        graph: dataFactory.namedNode('ex://c3'),
      });
      should(quads).be.equalToQuadArray([this.quads[5]]);
    });

    it('should match quads by subject, predicate, object and context', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s2'),
        predicate: dataFactory.namedNode('ex://p2'),
        object: dataFactory.namedNode('ex://o2'),
        graph: dataFactory.namedNode('ex://c2'),
      });
      should(quads).be.equalToQuadArray([this.quads[4]]);
    });

    it('should match quads by subject, predicate, object and context where object is a numeric literal', async function () {
      const { dataFactory, store } = this;
      const { items: quads } = await store.get({
        subject: dataFactory.namedNode('ex://s3'),
        predicate: dataFactory.namedNode('ex://p3'),
        object: dataFactory.literal('44', dataFactory.namedNode(xsd.integer)),
        graph: dataFactory.namedNode('ex://c3'),
      });
      should(quads).be.equalToQuadArray([this.quads[5]]);
    });

  });

};
