
const _ = require('../../dist/lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const {TSResultType, TSDefaultGraphMode} = require('../../dist/lib/types');

module.exports = () => {
  describe('named graphs', () => {

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
          factory.namedNode('http://ex.com/g2')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.namedNode('http://ex.com/o'),
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p'),
          factory.namedNode('http://ex.com/o2'),
          factory.defaultGraph(),
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.namedNode('http://ex.com/o2'),
          factory.namedNode('http://ex.com/g2')
        ),
      ];
      await this.store.multiPut(quads);
    });

    it('should bind to the terms of multiple quads matched by graph', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { GRAPH <http://ex.com/g2> { ?s ?p ?o . } . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(2);
    });

    it('should bind to the terms of zero quads matched by graph', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { GRAPH <http://ex.com/g3> { ?s ?p ?o . } . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(0);
    });

    it('should bind to the terms of all quads in all graphs (default option)', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s ?p ?o . }
      `);
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(5);
    });

    it('should bind to the terms of all quads in all graphs (explicit option)', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s ?p ?o . }
      `, { defaultGraphMode: TSDefaultGraphMode.MERGE });
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(5);
    });

    it('should bind to the terms of quads in the default graph (explicit option)', async function () {
      const { type, items } = await this.store.sparql(`
        SELECT * { ?s ?p ?o . }
      `, { defaultGraphMode: TSDefaultGraphMode.DEFAULT });
      should(type).equal(TSResultType.BINDINGS);
      should(items).have.length(1);
    });

  });

};
