
const should = require('should');
const factory = require('@rdfjs/data-model');
const {TSResultType} = require('../../dist/lib/types');

module.exports = () => {
  describe('CONSTRUCT', () => {

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


    it('should construct with a single pattern', async function () {
      const result = await this.store.sparql(`
        CONSTRUCT { ?s <http://ex.com/p3> <http://ex.com/o3> . }
        WHERE { ?s <http://ex.com/p> <http://ex.com/o>. }
      `);
      should(result.type).equal(TSResultType.QUADS);
      should(result.items).be.equalToQuadArray(
        [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p3'),
            factory.namedNode('http://ex.com/o3'),
            factory.defaultGraph(),
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p3'),
            factory.namedNode('http://ex.com/o3'),
            factory.defaultGraph(),
          ),
        ],
        this.store,
      );
    });


  });
}

