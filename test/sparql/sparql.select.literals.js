
const _ = require('../../dist/lib/utils');
const should = require('should');
const {ResultType} = require('../../dist/lib/types');
const xsd = require('../../dist/lib/serialization/xsd');

module.exports = () => {
  describe.skip('literals', () => {

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
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal('7.0', dataFactory.namedNode(xsd.double)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('2020-01-01T00:00:00.000Z', dataFactory.namedNode(xsd.dateTime)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.literal('true', dataFactory.namedNode(xsd.boolean)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.literal('42', dataFactory.namedNode(xsd.integer)),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/slang'),
          dataFactory.namedNode('http://ex.com/plang'),
          dataFactory.literal('hello, world', 'en'),
        ),
      ];
      await store.multiPut(quads);
    });

    it('should bind to the object of quads matched by an integer object literal', async function () {
      this.timeout(0);
      console.log('PRE');
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "7"^^<${xsd.integer}> . }
      `);
      console.log('POST');
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(2);
    });

    it('should bind to the object of quads matched by a double object literal', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "7.0"^^<${xsd.double}> . }
      `);
      should(results.type).equal(ResultType.BINDINGS);
      should(results.items).have.length(2);
    });

    it('should bind to the object of quads matched by a datetime object literal', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s ?p "2020-01-01T00:00:00.000Z"^^<${xsd.dateTime}> . }
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
