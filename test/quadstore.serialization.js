
const xsd = require('../dist/cjs/serialization/xsd');
const {quadWriter, quadReader} = require('../dist/cjs/serialization');
const {termReader, termWriter} = require('../dist/cjs/serialization/terms');

module.exports = () => {

  describe('Quadstore serialization', function () {

    const value = new Uint16Array(32);

    it('Should serialize and deserialize quads with named nodes', function () {
      const { store } = this;
      const { indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.namedNode('http://ex.com/o'),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, 0, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads in the default graph', function () {
      const { store } = this;
      const { indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.namedNode('http://ex.com/o'),
        factory.defaultGraph(),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, 0, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with generic literals', function () {
      const { store } = this;
      const { indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('someValue', factory.namedNode('http://ex.com/someDatatype')),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, 0, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with named nodes and language-tagged literals', function () {
      const { store } = this;
      const { indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('Hello, world!', 'en'),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, 0, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with named nodes and numeric literals', function () {
      const { store } = this;
      const { indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('44', factory.namedNode(xsd.decimal)),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, 0, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize a quad having a literal term that serializes to a string longer than 127 chars', async function () {
      const { store: { dataFactory: factory, indexes }, prefixes } = this;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal(''.padStart(2000, 'abab')),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, 0, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

  });

};
