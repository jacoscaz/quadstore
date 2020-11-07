
const _ = require('../../dist/lib/utils');
const should = require('should');
const {ResultType} = require('../../dist/lib/types');
const xsd = require('../../dist/lib/serialization/xsd');

module.exports = () => {
  describe('simple queries', () => {

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

    it('should bind to the subject of a quad matched by predicate and object', async function () {
      const {type, items} = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> "42"^^<${xsd.integer}> . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?s');
      should(items[0]['?s']).have.property('value');
      should(items[0]['?s']['value']).equal('http://ex.com/s2');
    });

    it('should bind to the object of a quad matched by subject and predicate', async function () {
      const {type, items} = await this.store.sparql(`
        SELECT * { <http://ex.com/s2> <http://ex.com/p> ?o . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?o');
      should(items[0]['?o']).have.property('value');
      should(items[0]['?o']['value']).equal('42');
      should(items[0]['?o']).have.property('datatype');
      should(items[0]['?o']['datatype'].value).equal(xsd.integer);
    });

    it('should bind to the graph of a quad matched by subject, predicate and object', async function () {
      const { dataFactory, store } = this;
      const {type, items} = await store.sparql(`
        SELECT * { GRAPH ?g { <http://ex.com/s2> <http://ex.com/p> "42"^^<${xsd.integer}> . } . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?g');
      should(items[0]['?g']).have.property('value');
      should(items[0]['?g']['value']).equal(dataFactory.defaultGraph().value);
    });

    it('should bind to the subject and object of two quads matched by predicate', async function () {
      const {type, items} = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> ?o . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(2);
      should(items[0]).have.property('?s');
      should(items[0]).have.property('?o');
      should(items[0]['?s'].value).equal('http://ex.com/s2');
      should(items[0]['?o'].value).equal('42');
      should(items[0]['?o'].datatype.value).equal(xsd.integer);
      should(items[1]).have.property('?s');
      should(items[1]).have.property('?o');
      should(items[1]['?s'].value).equal('http://ex.com/s');
      should(items[1]['?o'].value).equal('http://ex.com/o');
    });

  });

};
