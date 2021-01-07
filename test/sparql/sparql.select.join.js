const _ = require('../../dist/lib/utils');
const should = require('should');
const {ResultType} = require('../../dist/lib/types');
const xsd = require('../../dist/lib/serialization/xsd');

module.exports = () => {
  describe('join queries', () => {

    beforeEach(async function () {
      const { dataFactory, store } = this;
      const quads = [
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/bob'),
          dataFactory.namedNode('http://ex.com/greeting'),
          dataFactory.literal('hello'),
          dataFactory.defaultGraph(),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/bob'),
          dataFactory.namedNode('http://ex.com/knows'),
          dataFactory.namedNode('http://ex.com/alice'),
          dataFactory.defaultGraph()
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/bob'),
          dataFactory.namedNode('http://ex.com/age'),
          dataFactory.literal('40', xsd.integer),
          dataFactory.defaultGraph()
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/alice'),
          dataFactory.namedNode('http://ex.com/greeting'),
          dataFactory.literal('hi'),
          dataFactory.defaultGraph()
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/alice'),
          dataFactory.namedNode('http://ex.com/knows'),
          dataFactory.namedNode('http://ex.com/jacopo'),
          dataFactory.defaultGraph()
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/jacopo'),
          dataFactory.namedNode('http://ex.com/greeting'),
          dataFactory.literal('ciao'),
          dataFactory.defaultGraph()
        ),
      ];
      await store.multiPut(quads);
    });

    it('should join quad patterns', async function () {
      const {type, items} = await this.store.sparql(`
        SELECT * {
          ?s <http://ex.com/knows> ?s2 .
          ?s2 <http://ex.com/greeting> "hi"
        }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?s');
      should(items[0]['?s']).have.property('value');
      should(items[0]['?s']['value']).equal('http://ex.com/bob');
    });

    it.skip('should join quad patterns with numeric candidate', async function () {
      // `?s ?p ?s2` can generate a candidate where s2 is numeric
      // With bottom-up evaluation, this can lead to using the number as a subject
      const {type, items} = await this.store.sparql(`
        SELECT * {
          ?s2 <http://ex.com/greeting> "hi" .
          ?s ?p ?s2
        }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
      should(items[0]).have.property('?s');
      should(items[0]['?s']).have.property('value');
      should(items[0]['?s']['value']).equal('http://ex.com/bob');
    });

  });

};
