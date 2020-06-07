
import * as _ from '../utils/lodash';
import { Term, DataFactory, Literal, Quad, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject } from 'rdf-js';
import {IQSQuad, IQSQuadArrayResult, IQSRange, IQSTerms, IRSQuad, IRSRange, IRSTerms} from '../types';

const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString  = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdDateTime = xsd + 'dateTime';
const fpstring = require('./fpstring');
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

export const exportLiteralTerm = (term: string, dataFactory: DataFactory): Literal => {
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

export const importLiteralTerm = (term: Literal, rangeBoundary = false): string => {
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

export const exportTerm = (term: string, isGraph: boolean, defaultGraphValue: string, dataFactory: DataFactory): Term => {
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
      if (dataFactory.variable) {
        return dataFactory.variable(term.substr(1));
      }
      throw new Error('DataFactory does not support variables');
    case '^':
      if (isGraph) {
        throw new Error(`Invalid graph term "${term}" (graph cannot be a literal).`);
      }
      return exportLiteralTerm(term, dataFactory);
    default:
      return dataFactory.namedNode(term);
  }
}

export const importSimpleTerm = (term: Term, isGraph: boolean, defaultGraphValue: string): string => {
  if (!term) {
    if (isGraph) {
      return defaultGraphValue;
    }
    throw new Error(`Nil non-graph term, cannot import.`);
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
      return importLiteralTerm(term, false);
    default:
      // @ts-ignore
      throw new Error(`Unexpected termType: "${term.termType}".`);
  }
}

export const importTermRange = (range: IRSRange, rangeBoundary: boolean = false): IQSRange => {
  const importedRange: IQSRange = {};
  if (range.lt) importedRange.lt = importLiteralTerm(range.lt, rangeBoundary);
  if (range.lte) importedRange.lte = importLiteralTerm(range.lte, rangeBoundary);
  if (range.gt) importedRange.gt = importLiteralTerm(range.gt, rangeBoundary);
  if (range.gte) importedRange.gte = importLiteralTerm(range.gte, rangeBoundary);
  return importedRange;
}

export const importTerm = (term: Term|IRSRange, isGraph: boolean, defaultGraphValue: string, rangeBoundaryAllowed: boolean = false, rangeBoundary: boolean = false): string|IQSRange => {
  if ('gt' in term  || 'gte' in term || 'lt' in term || 'lte' in term) {
    return importTermRange(<IRSRange>term);
  } else if ('termType' in term) {
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
        // @ts-ignore
        throw new Error(`Unexpected termType: "${term.termType}".`);
    }
  } else {
    throw new Error(`Unexpected type of "term" argument.`);
  }
}

export const importQuad = (quad: IRSQuad, defaultGraphValue: string): IQSQuad => {
  return {
    subject: importSimpleTerm(quad.subject, false, defaultGraphValue),
    predicate: importSimpleTerm(quad.predicate, false, defaultGraphValue),
    object: importSimpleTerm(quad.object, false, defaultGraphValue),
    graph: importSimpleTerm(quad.graph, true, defaultGraphValue),
  };
}

const exportQuadSubject = (term: string, dataFactory: DataFactory): Quad_Subject => {
  switch (term[0]) {
    case '_':
      return dataFactory.blankNode(term.substr(2));
    case '?':
      if (dataFactory.variable) {
        return dataFactory.variable(term.substr(1));
      }
      throw new Error('DataFactory does not support variables');
    case '^':
      throw new Error('No literals as subject');
    default:
      return dataFactory.namedNode(term);
  }
}

const exportQuadPredicate = (term: string, dataFactory: DataFactory): Quad_Predicate => {
  switch (term[0]) {
    case '_':
      throw new Error('No blank nodes as predicates');
    case '?':
      if (dataFactory.variable) {
        return dataFactory.variable(term.substr(1));
      }
      throw new Error('DataFactory does not support variables');
    case '^':
      throw new Error('No literals as predicates');
    default:
      return dataFactory.namedNode(term);
  }
}

const exportQuadObject = (term: string, dataFactory: DataFactory): Quad_Object => {
  switch (term[0]) {
    case '_':
      return dataFactory.blankNode(term.substr(2));
    case '?':
      if (dataFactory.variable) {
        return dataFactory.variable(term.substr(1));
      }
      throw new Error('DataFactory does not support variables');
    case '^':
      return exportLiteralTerm(term, dataFactory);
    default:
      return dataFactory.namedNode(term);
  }
}

const exportQuadGraph = (term: string, defaultGraphValue: string, dataFactory: DataFactory): Quad_Graph => {
  if (term === defaultGraphValue) {
    return dataFactory.defaultGraph();
  }
  switch (term[0]) {
    case '_':
      return dataFactory.blankNode(term.substr(2));
    case '?':
      if (dataFactory.variable) {
        return dataFactory.variable(term.substr(1));
      }
      throw new Error('DataFactory does not support variables');
    case '^':
      throw new Error('No literals as graphs');
    default:
      return dataFactory.namedNode(term);
  }
}

export const exportQuad = (quad: IQSQuad, defaultGraphValue: string, dataFactory: DataFactory): IRSQuad => {
  return dataFactory.quad(
    exportQuadSubject(quad.subject, dataFactory),
    exportQuadPredicate(quad.predicate, dataFactory),
    exportQuadObject(quad.object, dataFactory),
    exportQuadGraph(quad.graph, defaultGraphValue, dataFactory)
  );
};

export const exportTerms = (terms: IQSTerms, defaultGraphValue: string, dataFactory: DataFactory): IRSTerms => {
  // @ts-ignore
  return _.mapValues(terms, (term: string) => exportTerm(term, false, defaultGraphValue, dataFactory));
};

export const importTerms = (terms: IRSTerms, defaultGraphValue: string, rangeBoundary: boolean = false): IQSTerms => {
  // @ts-ignore
  return _.mapValues(terms, (term: Term) => importTerm(term, false, defaultGraphValue, rangeBoundary));
};
