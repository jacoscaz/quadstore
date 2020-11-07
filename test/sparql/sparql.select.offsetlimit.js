
const _ = require('../../dist/lib/utils');
const should = require('should');
const {ResultType} = require('../../dist/lib/types');
const xsd = require('../../dist/lib/serialization/xsd');

module.exports = () => {
  describe('offset and limit', () => {

    beforeEach(async function () {
      const { dataFactory, store } = this;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.namedNode('http://ex.com/o'),
          dataFactory.namedNode('http://ex.com/g')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.namedNode('http://ex.com/o2'),
          dataFactory.defaultGraph(),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.namedNode('http://ex.com/o'),
          dataFactory.namedNode('http://ex.com/g')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('42', dataFactory.namedNode(xsd.integer)),
          dataFactory.defaultGraph(),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal('7.123', dataFactory.namedNode(xsd.double)),
          dataFactory.namedNode('http://ex.com/g2')
        ),
      ];
      await store.multiPut(quads);
    });

    it('should limit results to the desired qty', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> ?o . }
        LIMIT 1
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?s');
      should(items[0]).have.property('?o');
      should(items[0]['?s'].value).equal('http://ex.com/s2');
      should(items[0]['?o'].value).equal('42');
      should(items[0]['?o'].datatype.value).equal(xsd.integer);
    });

    it('should offset results by the desired qty', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> ?o . }
        OFFSET 1
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?s');
      should(items[0]).have.property('?o');
      should(items[0]['?s'].value).equal('http://ex.com/s');
      should(items[0]['?o'].value).equal('http://ex.com/o');
    });

  });

};
