
const _ = require('../../dist/cjs/lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const {TSResultType} = require('../../dist/cjs/lib/types');

const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString  = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdDateTime = xsd + 'dateTime';
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

module.exports = () => {
  describe('simple queries', () => {

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

    it('should bind to the subject of a quad matched by predicate and object', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> "42"^^<${xsdInteger}> . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?s');
      should(items[0]['?s']).have.property('value');
      should(items[0]['?s']['value']).equal('http://ex.com/s2');
    });

    it('should bind to the predicate of a quad matched by subject and object', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { <http://ex.com/s2> ?p "42"^^<${xsdInteger}> . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?p');
      should(items[0]['?p']).have.property('value');
      should(items[0]['?p']['value']).equal('http://ex.com/p');
    });

    it('should bind to the object of a quad matched by subject and predicate', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { <http://ex.com/s2> <http://ex.com/p> ?o . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?o');
      should(items[0]['?o']).have.property('value');
      should(items[0]['?o']['value']).equal('42');
      should(items[0]['?o']).have.property('datatype');
      should(items[0]['?o']['datatype'].value).equal(xsdInteger);
    });

    it('should bind to the graph of a quad matched by subject, predicate and object', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { GRAPH ?g { <http://ex.com/s2> <http://ex.com/p> "42"^^<${xsdInteger}> . } . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?g');
      should(items[0]['?g']).have.property('value');
      should(items[0]['?g']['value']).equal(factory.defaultGraph().value);
    });

    it('should bind to the subject and object of two quads matched by predicate', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> ?o . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(2);
      should(items[0]).have.property('?s');
      should(items[0]).have.property('?o');
      should(items[0]['?s'].value).equal('http://ex.com/s2');
      should(items[0]['?o'].value).equal('42');
      should(items[0]['?o'].datatype.value).equal(xsdInteger);
      should(items[1]).have.property('?s');
      should(items[1]).have.property('?o');
      should(items[1]['?s'].value).equal('http://ex.com/s');
      should(items[1]['?o'].value).equal('http://ex.com/o');
    });

  });

};
