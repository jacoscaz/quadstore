
const _ = require('../../dist/lib/utils/lodash');
const should = require('should');
const factory = require('@rdfjs/data-model');
const enums = require('../../dist/lib/utils/enums');

module.exports = () => {
  describe('SELECT', () => {

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
          factory.namedNode('http://ex.com/g')
        ),
        factory.quad(
          factory.namedNode('http://ex.com/s2'),
          factory.namedNode('http://ex.com/p2'),
          factory.namedNode('http://ex.com/o2'),
          factory.namedNode('http://ex.com/g2')
        ),
      ];
      await this.store.put(quads);
    });

    it('should select with a single pattern', async function () {
      const results = await this.store.sparql(`
        SELECT * { ?s <http://ex.com/p> <http://ex.com/o>. }
      `);
      should(results.type).equal(enums.resultType.BINDINGS);
      should(results.items).have.length(2);
    });

    it('should select with multiple patterns', async function () {
      const results = await this.store.sparql(`
        SELECT ?s ?o {
          ?s <http://ex.com/p> <http://ex.com/o>.
          ?s <http://ex.com/p2> ?o.
        }
      `);
      should(results.type).equal(enums.resultType.BINDINGS);
      should(results.items).have.length(2);
    });

    it('should select with simple filter', async function () {
      const results = await this.store.sparql(`
        SELECT ?s {
          ?s <http://ex.com/p> <http://ex.com/o> .
          FILTER (?s < <http://ex.com/s2>)
        }
      `);
      should(results.type).equal(enums.resultType.BINDINGS);
      should(results.items).have.length(1);
    });

  });

};
