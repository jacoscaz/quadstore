
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
  describe('literals', () => {

    beforeEach(async function () {
      const quads = [
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('7', factory.namedNode(xsdInteger)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('7.0', factory.namedNode(xsdDouble)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('2020-01-01T00:00:00.000Z', factory.namedNode(xsdDateTime)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.literal('true', factory.namedNode(xsdBoolean)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.literal('42', factory.namedNode(xsdInteger)),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/slang'),
          factory.namedNode('http://ex.com/plang'),
          factory.literal('hello, world', 'en'),
        ),
      ];
      await this.store.multiPut(quads);
    });

    it('should bind to the object of quads matched by an integer object literal', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "7"^^<${xsdInteger}> . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(2);
    });

    it('should bind to the object of quads matched by a double object literal', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "7.0"^^<${xsdDouble}> . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(2);
    });

    it('should bind to the object of quads matched by a datetime object literal', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "2020-01-01T00:00:00.000Z"^^<${xsdDateTime}> . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(1);
    });

    it('should bind to the object of a quad matched by a literal with a language tag', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "hello, world"@en . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(1);
    });

    it('should not bind to the object of a quad matched by a literal without a language tag', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "hello, world" . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(0);
    });

  });

};
