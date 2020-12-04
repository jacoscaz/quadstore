
const should = require('should');
const {ResultType} = require('../../dist/lib/types');

module.exports = () => {
  describe('DESCRIBE', () => {

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
          dataFactory.namedNode('http://ex.com/p2'),
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

    it('should describe an IRI', async function () {
      const { dataFactory, store } = this;
      const result = await store.sparql(`
        DESCRIBE <http://ex.com/s>
      `);
      should(result.type).equal(ResultType.QUADS);
      should(result.items).be.equalToQuadArray(
        [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.namedNode('http://ex.com/o'),
            dataFactory.defaultGraph(),
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p2'),
            dataFactory.namedNode('http://ex.com/o2'),
            dataFactory.defaultGraph(),
          ),
        ],
        store,
      );
    });

    it('should describe with a single pattern', async function () {
      const { dataFactory, store } = this;
      const result = await store.sparql(`
        DESCRIBE ?s
        WHERE { ?s <http://ex.com/p> <http://ex.com/o>. }
      `);
      should(result.type).equal(ResultType.QUADS);
      should(result.items).be.equalToQuadArray(
        [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.namedNode('http://ex.com/o'),
            dataFactory.defaultGraph(),
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p2'),
            dataFactory.namedNode('http://ex.com/o2'),
            dataFactory.defaultGraph(),
          ),
        ],
        store,
      );
    });

  });
}

