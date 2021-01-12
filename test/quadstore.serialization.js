
const xsd = require('../dist/lib/serialization/xsd');
const {quadWriter, quadReader} = require('../dist/lib/serialization');

module.exports = () => {

  describe('Quadstore serialization', function () {

    const value = Buffer.alloc(32);

    it('Should serialize and deserialize quads with named nodes', function () {
      const { store } = this;
      const { separator, boundary, indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.namedNode('http://ex.com/o'),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, separator, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, separator, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads in the default graph', function () {
      const { store } = this;
      const { separator, boundary, indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.namedNode('http://ex.com/o'),
        factory.defaultGraph(),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, separator, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, separator, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with generic literals', function () {
      const { store } = this;
      const { separator, boundary, indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('someValue', factory.namedNode('http://ex.com/someDatatype')),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, separator, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, separator, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with named nodes and language-tagged literals', function () {
      const { store } = this;
      const { separator, boundary, indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('Hello, world!', 'en'),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, separator, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, separator, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with named nodes and numeric literals', function () {
      const { store } = this;
      const { separator, boundary, indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('44', factory.namedNode(xsd.decimal)),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, separator, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, separator, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

    it('Should serialize and deserialize quads with named nodes and simple string literals', function () {
      const { store } = this;
      const { separator, boundary, indexes, prefixes, dataFactory: factory } = store;
      const quad = factory.quad(
        factory.namedNode('http://ex.com/s'),
        factory.namedNode('http://ex.com/p'),
        factory.literal('someString'),
        factory.namedNode('http://ex.com/g'),
      );
      indexes.forEach((index) => {
        const key = quadWriter.write(index.prefix, value, separator, quad, index.terms, prefixes);
        const read = quadReader.read(key, index.prefix.length, value, 0, separator, index.terms, factory, prefixes);
        should(read.equals(quad)).be.true();
      });
    });

  });




};
