
const _ = require('../../dist-cjs/lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const {TSResultType} = require('../../dist-cjs/lib/types');

module.exports = () => {
  describe('literal filters', () => {

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
      await this.store.multiPut(quads);
    });

    it('should select with simple filter', async function () {
      const results = await this.store.sparql(`
        SELECT ?s {
          ?s <http://ex.com/p> <http://ex.com/o> .
          FILTER (?s < <http://ex.com/s2>)
        }
      `);
      should(results.type).equal(TSResultType.BINDINGS);
      should(results.items).have.length(1);
    });

  });

};
