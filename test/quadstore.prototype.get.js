
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

  describe.only('Quadstore.prototype.get() w/ order', () => {

    beforeEach(async function () {
      const { dataFactory } = this;
      const subject = dataFactory.namedNode('ex://s');
      const graph = dataFactory.namedNode('ex://g');
      const decimal = dataFactory.namedNode(xsd.decimal);
      for (let i = 10; i < 100; i += 1) {
        await this.store.put(dataFactory.quad(
          subject,
          dataFactory.namedNode(`ex://p${99 - i}`),
          dataFactory.literal(`${i}`, decimal),
          graph,
        ));
      }
    });
    
    it('should produce the same results whether sorting in-memory or not', async function () {
      const { dataFactory, store } = this;
      const memResults = await store.get(
        { graph: dataFactory.namedNode('ex://g') },
        { order: ['object'] },
      );
      should(memResults.resorted).eql(true);
      const idxResults = await store.get(
        { subject: dataFactory.namedNode('ex://s') },
        { order: ['object'] },
      );
      should(idxResults.resorted).eql(false);
      should(_.arrStartsWith(idxResults.order, ['object'])).be.true();
      should(_.arrStartsWith(memResults.order, ['object'])).be.true();
      should(idxResults.items).have.length(90);
      should(idxResults.items).be.equalToQuadArray(memResults.items);
      should(idxResults.items[0].object.value).eql('10');
      should(idxResults.items[89].object.value).eql('99');
    });

    it('should produce the same results whether sorting in-memory or not, in reverse', async function () {
      const { dataFactory, store } = this;
      const memResults = await store.get(
        { graph: dataFactory.namedNode('ex://g') },
        { order: ['object'], reverse: true },
      );
      should(memResults.resorted).eql(true);
      const idxResults = await store.get(
        { subject: dataFactory.namedNode('ex://s') },
        { order: ['object'], reverse: true },
      );
      should(idxResults.resorted).eql(false);
      should(_.arrStartsWith(idxResults.order, ['object'])).be.true();
      should(_.arrStartsWith(memResults.order, ['object'])).be.true();
      should(idxResults.items).have.length(90);
      should(idxResults.items).be.equalToQuadArray(memResults.items);
      should(idxResults.items[0].object.value).eql('99');
      should(idxResults.items[89].object.value).eql('10');
    });

    it('should order by predicate while querying for a range of object literals, sorting in memory', async function () {
      const { dataFactory, store } = this;
      const memResults = await store.get(
        {
          object: {
            termType: 'Range',
            lt: dataFactory.literal('20', dataFactory.namedNode(xsd.decimal)),
          },
        },
        { order: ['predicate'] },
      );
      should(memResults.resorted).eql(true);
      should(memResults.items).have.length(10);
      should(memResults.items[0].predicate.value).eql(`ex://p80`);
      should(memResults.items[9].predicate.value).eql(`ex://p89`);
    });

    it('should order by predicate while querying for a range of object literals, sorting in memory, in reverse', async function () {
      const { dataFactory, store } = this;
      const memResults = await store.get(
        {
          object: {
            termType: 'Range',
            lt: dataFactory.literal('20', dataFactory.namedNode(xsd.decimal)),
          },
        },
        { order: ['predicate'], reverse: true },
      );
      should(memResults.resorted).eql(true);
      should(memResults.items).have.length(10);
      should(memResults.items[0].predicate.value).eql(`ex://p89`);
      should(memResults.items[9].predicate.value).eql(`ex://p80`);
    });

    it('should order by object while querying for a range of object literals without sorting in memory', async function () {
      const { dataFactory, store } = this;
      const memResults = await store.get(
        {
          object: {
            termType: 'Range',
            lt: dataFactory.literal('20', dataFactory.namedNode(xsd.decimal)),
          },
        },
        { order: ['object'] },
      );
      should(memResults.resorted).eql(false);
      should(memResults.items).have.length(10);
      should(memResults.items[0].object.value).eql(`10`);
      should(memResults.items[9].object.value).eql(`19`);
    });

    it('should order by object while querying for a range of object literals without sorting in memory, in reverse', async function () {
      const { dataFactory, store } = this;
      const memResults = await store.get(
        {
          object: {
            termType: 'Range',
            lt: dataFactory.literal('20', dataFactory.namedNode(xsd.decimal)),
          },
        },
        { order: ['object'], reverse: true },
      );
      should(memResults.resorted).eql(false);
      should(memResults.items).have.length(10);
      should(memResults.items[0].object.value).eql(`19`);
      should(memResults.items[9].object.value).eql(`10`);
    });

  });

};
