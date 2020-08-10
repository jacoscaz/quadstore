
const should = require('should');
const factory = require('@rdfjs/data-model');
const {TSResultType} = require('../../dist/lib/types');

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
      await this.store.multiPut(quads);
    });


    it('should select with a single pattern', async function () {
      const results = await this.store.sparql(`
        CONSTRUCT { ?s <http://ex.com/p2> <http://ex.com/o2> . }
        WHERE { ?s <http://ex.com/p> <http://ex.com/o>. }
      `);
      should(results.type).equal(TSResultType.QUADS);
      should(results.items).have.length(2);
    });


  });
}

