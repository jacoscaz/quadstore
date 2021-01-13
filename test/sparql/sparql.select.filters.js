
const _ = require('../../dist/lib/utils');
const should = require('should');
const {ResultType} = require('../../dist/lib/types');
const xsd = require('../../dist/lib/serialization/xsd');

module.exports = () => {
  describe('filters on numeric literals', () => {

    beforeEach(async function () {
      const { dataFactory, store } = this;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('7', dataFactory.namedNode(xsd.integer)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('7.0', dataFactory.namedNode(xsd.double)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('42', dataFactory.namedNode(xsd.integer)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('-1', dataFactory.namedNode(xsd.integer)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('3.14', dataFactory.namedNode(xsd.double)),
        ),
      ];
      await store.multiPut(quads);
    });

    it('should filter by "="', async function () {
      const { dataFactory, store } = this;
      const results = await store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o = 7) . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': dataFactory.literal('7', dataFactory.namedNode(xsd.integer)) },
          { '?o': dataFactory.literal('7.0', dataFactory.namedNode(xsd.double)) },
        ],
        results.variables,
      );
    });

    it('should filter by "<"', async function () {
      const { dataFactory, store } = this;
      const results = await store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o < 1) . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': dataFactory.literal('-1', dataFactory.namedNode(xsd.integer)) }
        ],
        results.variables
      );
    });

    it('should filter by "<="', async function () {
      const { dataFactory, store } = this;
      const results = await store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o <= 3.14) . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': dataFactory.literal('3.14', dataFactory.namedNode(xsd.double)) },
          { '?o': dataFactory.literal('-1', dataFactory.namedNode(xsd.integer)) },
        ],
        results.variables
      );
    });

    it('should filter by ">"', async function () {
      const { dataFactory, store } = this;
      const results = await store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o > 3.14) . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': dataFactory.literal('7', dataFactory.namedNode(xsd.integer)) },
          { '?o': dataFactory.literal('7.0', dataFactory.namedNode(xsd.double)) },
          { '?o': dataFactory.literal('42', dataFactory.namedNode(xsd.integer)) },
        ],
        results.variables
      );
    });

    it('should filter by ">="', async function () {
      const { dataFactory, store } = this;
      const results = await store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o >= 3.14) . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': dataFactory.literal('42', dataFactory.namedNode(xsd.integer)) },
          { '?o': dataFactory.literal('3.14', dataFactory.namedNode(xsd.double)) },
          { '?o': dataFactory.literal('7', dataFactory.namedNode(xsd.integer)) },
          { '?o': dataFactory.literal('7.0', dataFactory.namedNode(xsd.double)) },
        ],
        results.variables
      );
    });

    it('should filter by inverted ">="', async function () {
      const { dataFactory, store } = this;
      const results = await store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(3.14 >= ?o) . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': dataFactory.literal('3.14', dataFactory.namedNode(xsd.double)) },
          { '?o': dataFactory.literal('-1', dataFactory.namedNode(xsd.integer)) },
        ],
        results.variables
      );
    });



  });

};
