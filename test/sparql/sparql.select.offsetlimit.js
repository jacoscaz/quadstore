
const _ = require('../../dist/lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const {ResultType} = require('../../dist/lib/types');

const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString  = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdDateTime = xsd + 'dateTime';
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

module.exports = () => {
  describe('offset and limit', () => {

    beforeEach(async function () {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.namedNode('http://ex.com/o'),
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p2'),
          factory.namedNode('http://ex.com/o2'),
          factory.defaultGraph(),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.namedNode('http://ex.com/o'),
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('42', factory.namedNode(xsdInteger)),
          factory.defaultGraph(),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('7.123', factory.namedNode(xsdDouble)),
          factory.namedNode('http://ex.com/g2')
        ),
      ];
      await this.store.multiPut(quads);
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
      should(items[0]['?o'].datatype.value).equal(xsdInteger);
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
