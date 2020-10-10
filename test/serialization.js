const dataFactory = require('@rdfjs/data-model');
const { RdfSerialization } = require('../dist/lib/rdf/serialization');

module.exports = () => {
  describe('Serialization', () => {
    beforeEach(() => {
      this.serialization = new RdfSerialization(dataFactory, {
        expandTerm: term => term.replace(/^ex:/, 'http://ex.com/'),
        compactIri: iri => iri.replace(/^http:\/\/ex\.com\//, 'ex:')
      });
    });

    it('should apply prefixes to import named node', () => {
      const term = this.serialization.importTerm(dataFactory.namedNode('http://ex.com/a'), false, '');
      should(term).equal('ex:a');
    });

    it('should apply prefixes to import literal datatype', () => {
      const literal = this.serialization.importTerm(
        dataFactory.literal('a', dataFactory.namedNode('http://ex.com/a')), false, '');
      should(literal).equal(`\u0001\u0001ex:a\u0001\u0001a\u0001`);
    });

    it('should un-apply prefixes to export named node', () => {
      const iri = this.serialization.exportTerm('ex:a', false, '');
      should(iri.equals(dataFactory.namedNode('http://ex.com/a'))).equal(true);
    });

    it('should un-apply prefixes to export literal datatype', () => {
      const literal = this.serialization.exportTerm(`\u0001\u0001ex:a\u0001\u0001a\u0001`, false, '');
      should(literal.equals(dataFactory.literal('a', dataFactory.namedNode('http://ex.com/a')))).equal(true);
    });
  })
};
