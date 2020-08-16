
const _ = require('../../dist/lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const {TSResultType} = require('../../dist/lib/types');

const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString  = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdDateTime = xsd + 'dateTime';
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

module.exports = () => {
  describe('filters on numeric literals', () => {

    beforeEach(async function () {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('7', factory.namedNode(xsdInteger)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('7.0', factory.namedNode(xsdDouble)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('42', factory.namedNode(xsdInteger)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('-1', factory.namedNode(xsdInteger)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('3.14', factory.namedNode(xsdDouble)),
        ),
      ];
      await this.store.multiPut(quads);
    });

    it('should filter by "="', async function () {
      const results = await this.store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o = 7) . }
      `);
      should(results.type).equal(TSResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': factory.literal('7', factory.namedNode(xsdInteger)) },
          { '?o': factory.literal('7.0', factory.namedNode(xsdDouble)) },
        ],
        this.store,
        Object.keys(results.variables),
      );
    });

    it('should filter by "<"', async function () {
      const results = await this.store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o < 1) . }
      `);
      should(results.type).equal(TSResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': factory.literal('-1', factory.namedNode(xsdInteger)) }
        ],
        this.store,
        Object.keys(results.variables),
      );
    });

    it('should filter by "<="', async function () {
      const results = await this.store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o <= 3.14) . }
      `);
      should(results.type).equal(TSResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': factory.literal('3.14', factory.namedNode(xsdDouble)) },
          { '?o': factory.literal('-1', factory.namedNode(xsdInteger)) },
        ],
        this.store,
        Object.keys(results.variables),
      );
    });

    it('should filter by ">"', async function () {
      const results = await this.store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o > 3.14) . }
      `);
      should(results.type).equal(TSResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': factory.literal('7', factory.namedNode(xsdInteger)) },
          { '?o': factory.literal('7.0', factory.namedNode(xsdDouble)) },
          { '?o': factory.literal('42', factory.namedNode(xsdInteger)) },
        ],
        this.store,
        Object.keys(results.variables),
      );
    });

    it('should filter by ">="', async function () {
      const results = await this.store.sparql(`
        SELECT ?o { ?s <http://ex.com/p> ?o . FILTER(?o >= 3.14) . }
      `);
      should(results.type).equal(TSResultType.BINDINGS);
      should(results.items).be.equalToBindingArray(
        [
          { '?o': factory.literal('42', factory.namedNode(xsdInteger)) },
          { '?o': factory.literal('3.14', factory.namedNode(xsdDouble)) },
          { '?o': factory.literal('7', factory.namedNode(xsdInteger)) },
          { '?o': factory.literal('7.0', factory.namedNode(xsdDouble)) },
        ],
        this.store,
        Object.keys(results.variables),
      );
    });



  });

};
