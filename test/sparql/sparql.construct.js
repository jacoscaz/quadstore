
const should = require('should');
const {ResultType} = require('../../dist/lib/types');

module.exports = () => {
  describe('CONSTRUCT', () => {

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
          dataFactory.namedNode('http://ex.com/g')
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


    it('should construct with a single pattern', async function () {
      const { dataFactory, store } = this;
      const result = await store.sparql(`
        CONSTRUCT { ?s <http://ex.com/p3> <http://ex.com/o3> . }
        WHERE { ?s <http://ex.com/p> <http://ex.com/o>. }
      `);
      should(result.type).equal(ResultType.QUADS);
      should(result.items).be.equalToQuadArray(
        [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p3'),
            dataFactory.namedNode('http://ex.com/o3'),
            dataFactory.defaultGraph(),
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s2'),
            dataFactory.namedNode('http://ex.com/p3'),
            dataFactory.namedNode('http://ex.com/o3'),
            dataFactory.defaultGraph(),
          ),
        ],
        store,
      );
    });


  });
}

