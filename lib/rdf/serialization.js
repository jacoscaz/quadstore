
'use strict';

const _ = require('../utils/lodash');
const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString  = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdDateTime = xsd + 'dateTime';
const fpstring = require('./fpstring');
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

function exportLiteralTerm(term, dataFactory) {
  const [, encoding, datatype, value, language] = term.split('^');
  switch (datatype) {
    case xsdString:
      if (language !== '') {
        return dataFactory.literal(value, language);
      }
      return dataFactory.literal(value);
    default:
      return dataFactory.literal(value, dataFactory.namedNode(datatype));
  }
}

function importLiteralTerm(term, rangeBoundary = false) {
  if (term.language) {
    return `^^${xsdString}^${term.value}^${term.language}`;
  }
  if (!term.datatype || term.datatype.value === xsdString) {
    return `^^${term.datatype.value}^${term.value}^`;
  }
  switch (term.datatype.value) {
    case xsdInteger:
    case xsdDouble:
      if (rangeBoundary) {
        return `^number:${fpstring(term.value.slice(1, -1))}`;
      }
      return `^number:${fpstring(term.value.slice(1, -1))}^${term.datatype.value}^${term.value}^`;
    case xsdDateTime:
      const timestamp = new Date(term.value.slice(1, -1)).valueOf();
      if (rangeBoundary) {
        return `^datetime:${fpstring(timestamp)}`;
      }
      return `^datetime:${fpstring(timestamp)}^${term.datatype.value}^${term.value}^`;
    default:
      return `^^${term.datatype.value}^${term.value}^`;
  }
}

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
    case '^':
      if (isGraph) {
        throw new Error(`Invalid graph term "${term}" (graph cannot be a literal).`);
      }
      return exportLiteralTerm(term, dataFactory);
    default:
      return dataFactory.namedNode(term);
  }
}

module.exports.exportTerm = exportTerm;

function importTerm(term, isGraph, defaultGraphValue, rangeBoundaryAllowed = false, rangeBoundary = false) {
  if (!term) {
    if (isGraph) {
      return defaultGraphValue;
    }
    throw new Error(`Nil non-graph term, cannot import.`);
  }
  if (rangeBoundaryAllowed) {
    if (Array.isArray(term)) {
      return term.map(e => importTerm(e, isGraph, defaultGraphValue, rangeBoundaryAllowed, true));
    }
    if (term.gt || term.gte || term.lt || term.lte) {
      return _.mapValues(term, v => importTerm(v, isGraph, defaultGraphValue, rangeBoundaryAllowed, true));
    }
  } else if (typeof(term.termType) !== 'string' || typeof(term.value) !== 'string') {
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
    return importLiteralTerm(term, rangeBoundary);
    default:
      throw new Error(`Unexpected termType: "${term.termType}".`);
  }
}

module.exports.importTerm = importTerm;

function importQuad(quad, defaultGraphValue) {
  return {
    subject: importTerm(quad.subject, false, defaultGraphValue, false),
    predicate: importTerm(quad.predicate, false, defaultGraphValue, false),
    object: importTerm(quad.object, false, defaultGraphValue, false),
    graph: importTerm(quad.graph, true, defaultGraphValue, false),
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

function importTerms(terms, defaultGraphValue, rangeBoundary = false) {
  return _.mapValues(terms, term => importTerm(term, false, defaultGraphValue, rangeBoundary));
}

module.exports.importTerms = importTerms;
