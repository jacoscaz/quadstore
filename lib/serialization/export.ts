import {DataFactory, Literal, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject} from 'rdf-js';
import {ImportedQuad, Prefixes, Quad} from '../types';
import * as xsd from './xsd';

export const exportLiteralTerm = (term: string, dataFactory: DataFactory, prefixes: Prefixes): Literal => {
  const [, encoding, datatype, language, value] = term.split('^');
  switch (datatype) {
    case xsd.langString:
      if (language !== '') {
        return dataFactory.literal(value, language);
      }
      return dataFactory.literal(value);
    default:
      return dataFactory.literal(value, dataFactory.namedNode(prefixes.expandTerm(datatype)));
  }
}

const exportQuadSubject = (term: string, dataFactory: DataFactory, prefixes: Prefixes): Quad_Subject => {
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
      return dataFactory.namedNode(prefixes.expandTerm(term));
  }
}

const exportQuadPredicate = (term: string, dataFactory: DataFactory, prefixes: Prefixes): Quad_Predicate => {
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
      return dataFactory.namedNode(prefixes.expandTerm(term));
  }
}

const exportQuadObject = (term: string, dataFactory: DataFactory, prefixes: Prefixes): Quad_Object => {
  switch (term[0]) {
    case '_':
      return dataFactory.blankNode(term.substr(2));
    case '?':
      if (dataFactory.variable) {
        return dataFactory.variable(term.substr(1));
      }
      throw new Error('DataFactory does not support variables');
    case '^':
      return exportLiteralTerm(term, dataFactory, prefixes);
    default:
      return dataFactory.namedNode(prefixes.expandTerm(term));
  }
}

const exportQuadGraph = (term: string, defaultGraphValue: string, dataFactory: DataFactory, prefixes: Prefixes): Quad_Graph => {
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
      return dataFactory.namedNode(prefixes.expandTerm(term));
  }
}

export const exportQuad = (quad: ImportedQuad, defaultGraphValue: string, dataFactory: DataFactory, prefixes: Prefixes): Quad => {
  return dataFactory.quad(
    exportQuadSubject(quad.subject, dataFactory, prefixes),
    exportQuadPredicate(quad.predicate, dataFactory, prefixes),
    exportQuadObject(quad.object, dataFactory, prefixes),
    exportQuadGraph(quad.graph, defaultGraphValue, dataFactory, prefixes)
  );
};

export const deserializeImportedQuad = (quad: string): ImportedQuad => {
  return JSON.parse(quad);
};
