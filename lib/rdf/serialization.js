
'use strict';

const _ = require('lodash');
const stream = require('stream');

const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString  = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

function exportTerm(term, isGraph, defaultGraphValue, dataFactory) {
  if (!term) {
    throw new Error(`Nil term "${term}". Cannot export.`);
  }
  if (term === defaultGraphValue) {
    return dataFactory.defaultGraph();
  }
  switch (term[0]) {
    case '_': 
      return dataFactory.blankNode(term.substr(2));
    case '?': 
      return dataFactory.variable(term.substr(1));
    case '"':
      if (isGraph) {
        throw new Error(`Invalid graph term "${term}" (graph cannot be a literal).`);
      }
      // Literal without datatype or language
      if (term[term.length - 1] === '"') {
        return dataFactory.literal(term.substr(1, term.length - 2));
      }
      // Literal with datatype or language
      const endPos = term.lastIndexOf('"', term.length - 1);
      return dataFactory.literal(
        term.substr(1, endPos - 1),
        term[endPos + 1] === '@' 
          ? term.substr(endPos + 2) 
          : dataFactory.namedNode(term.substr(endPos + 3))
      );
    default:  
      return dataFactory.namedNode(term);
  }
}

module.exports.exportTerm = exportTerm;

function importTerm(term, isGraph, defaultGraphValue) {
  if (!term) {
    if (isGraph) {
      return defaultGraphValue;
    }
    throw new Error(`Nil non-graph term, cannot import.`);
  }
  if (typeof(term.termType) !== 'string' || typeof(term.value) !== 'string') {
    throw new Error(`Invalid term, cannot import.`);
  }
  switch (term.termType) {
  case 'NamedNode':
    return term.value;
  case 'BlankNode':
    return '_:' + term.value;
  case 'Variable':
    return '?' + term.value;
  case 'DefaultGraph': 
    return defaultGraphValue;
  case 'Literal': 
    return '"' + term.value + '"' + (
      term.language 
        ? '@' + term.language 
        : (term.datatype && term.datatype.value !== xsdString ? '^^' + term.datatype.value : '')
    );
    default: 
      throw new Error(`Unexpected termType: "${term.termType}".`);
  }
}

module.exports.importTerm = importTerm;

function importQuad(quad, defaultGraphValue) {
  return {
    subject: importTerm(quad.subject, false, defaultGraphValue),
    predicate: importTerm(quad.predicate, false, defaultGraphValue),
    object: importTerm(quad.object, false, defaultGraphValue),
    graph: importTerm(quad.graph, true, defaultGraphValue)
  };
}

module.exports.importQuad = importQuad;

function exportQuad(_quad, defaultGraphValue, dataFactory) {
  return dataFactory.quad(
    exportTerm(_quad.subject, false, defaultGraphValue, dataFactory),
    exportTerm(_quad.predicate, false, defaultGraphValue, dataFactory),
    exportTerm(_quad.object, false, defaultGraphValue, dataFactory),
    exportTerm(_quad.graph, true, defaultGraphValue, dataFactory)
  );
}

module.exports.exportQuad = exportQuad;

function exportTerms(terms, defaultGraphValue, dataFactory) {
  return _.mapValues(terms, term => exportTerm(term, false, defaultGraphValue, dataFactory));
}

module.exports.exportTerms = exportTerms;

function importTerms(terms, defaultGraphValue) {
  return _.mapValues(terms, term => importTerm(term, false, defaultGraphValue));
}

module.exports.importTerms = importTerms;

function createQuadImporterStream(defaultGraphValue) {
  const serializerStream = new stream.Transform({
    objectMode: true,
    transform(quad, enc, cb) {
      this.push(importQuad(quad, defaultGraphValue));
      this.count += 1;
      cb();
    }
  });
  serializerStream.count = 0;
  return serializerStream;
}

module.exports.createQuadImporterStream = createQuadImporterStream;

function createQuadExporterStream(defaultGraphValue, dataFactory) {
  const deserializerStream = new stream.Transform({
    objectMode: true,
    transform(quad, enc, cb) {
      this.push(exportQuad(quad, defaultGraphValue, dataFactory));
      this.count += 1;
      cb();
    }
  });
  deserializerStream.count = 0;
  return deserializerStream;
}

module.exports.createQuadExporterStream = createQuadExporterStream;

function createTermsExporterStream(defaultGraphValue, dataFactory) { 
  const deserializerStream = new stream.Transform({
    objectMode: true,
    transform(terms, enc, cb) {
      this.push(exportTerms(terms, defaultGraphValue, dataFactory));
      this.count += 1;
      cb();
    }
  });
  deserializerStream.count = 0;
  return deserializerStream;
}

module.exports.createTermsExporterStream = createTermsExporterStream;
