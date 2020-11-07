
const _ = require('../../dist/lib/utils');
const should = require('should');
const {ResultType, DefaultGraphMode} = require('../../dist/lib/types');

module.exports = () => {
  describe('named graphs', () => {

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
          dataFactory.namedNode('http://ex.com/g2')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.namedNode('http://ex.com/o'),
          dataFactory.namedNode('http://ex.com/g')
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p'),
          dataFactory.namedNode('http://ex.com/o2'),
          dataFactory.defaultGraph(),
        ),
        dataFactory.quad(
          dataFactory.namedNode('http://ex.com/s2'),
          dataFactory.namedNode('http://ex.com/p2'),
          dataFactory.namedNode('http://ex.com/o2'),
          dataFactory.namedNode('http://ex.com/g2')
        ),
      ];
      await store.multiPut(quads);
    });

    it('should bind to the terms of multiple quads matched by graph', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { GRAPH <http://ex.com/g2> { ?s ?p ?o . } . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(2);
    });

    it('should bind to the terms of zero quads matched by graph', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { GRAPH <http://ex.com/g3> { ?s ?p ?o . } . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(0);
    });

    it('should bind to the terms of all quads in all graphs (default option)', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s ?p ?o . }
      `);
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(5);
    });

    it('should bind to the terms of all quads in all graphs (explicit option)', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s ?p ?o . }
      `, { defaultGraphMode: DefaultGraphMode.UNION });
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(5);
    });

    it('should bind to the terms of quads in the default graph (explicit option)', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s ?p ?o . }
      `, { defaultGraphMode: DefaultGraphMode.DEFAULT });
      should(type).equal(ResultType.BINDINGS);
      should(items).have.length(1);
    });

  });

};
