import {Literal, Term} from 'rdf-js';
import {encode} from './fpstring';
import * as xsd from './xsd';
import {
  ImportedPattern,
  ImportedQuad,
  ImportedRange,
  Pattern, Prefixes,
  Quad,
  Range
} from '../types';

export const importLiteralTerm = (term: Literal, prefixes: Prefixes, rangeBoundary = false): string => {
  const { language, datatype, value } = term;
  if (language !== '') {
    return `^^${prefixes.compactIri(xsd.langString)}^${language}^${value}`;
  }
  if (!datatype || datatype.value === xsd.string) {
    return `^^${prefixes.compactIri(xsd.string)}^^${prefixes.compactIri(value)}`;
  }
  switch (datatype.value) {
    case xsd.integer:
    case xsd.double:
    case xsd.decimal:
    case xsd.nonPositiveInteger:
    case xsd.negativeInteger:
    case xsd.long:
    case xsd.int:
    case xsd.short:
    case xsd.byte:
    case xsd.nonNegativeInteger:
    case xsd.unsignedLong:
    case xsd.unsignedInt:
    case xsd.unsignedShort:
    case xsd.unsignedByte:
    case xsd.positiveInteger:
      if (rangeBoundary) {
        return `^number:${encode(value)}^`;
      }
      return `^number:${encode(value)}^${prefixes.compactIri(datatype.value)}^^${value}^`;
    case xsd.dateTime:
      const timestamp = new Date(value).valueOf();
      if (rangeBoundary) {
        return `^datetime:${encode(timestamp)}^`;
      }
      return `^datetime:${encode(timestamp)}^${prefixes.compactIri(datatype.value)}^^${value}^`;
    default:
      return `^^${prefixes.compactIri(datatype.value)}^^${value}^`;
  }
};

export const importSimpleTerm = (term: Term, isGraph: boolean, defaultGraphValue: string, prefixes: Prefixes, rangeBoundary: boolean = false): string => {
  if (!term) {
    if (isGraph) {
      return defaultGraphValue;
    }
    throw new Error(`Nil non-graph term, cannot import.`);
  }
  switch (term.termType) {
    case 'NamedNode':
      return prefixes.compactIri(term.value);
    case 'BlankNode':
      return `_:${term.value}`;
    case 'Variable':
      return `?${term.value}`;
    case 'DefaultGraph':
      return defaultGraphValue;
    case 'Literal':
      return importLiteralTerm(term, prefixes, rangeBoundary);
    default:
      // @ts-ignore
      throw new Error(`Unexpected termType: "${term.termType}".`);
  }
};

export const importRange = (range: Range, prefixes: Prefixes, rangeBoundary: boolean = false): ImportedRange => {
  const importedRange: ImportedRange = {};
  if (range.lt) importedRange.lt = importLiteralTerm(range.lt, prefixes, rangeBoundary);
  if (range.lte) importedRange.lte = importLiteralTerm(range.lte, prefixes, rangeBoundary);
  if (range.gt) importedRange.gt = importLiteralTerm(range.gt, prefixes, rangeBoundary);
  if (range.gte) importedRange.gte = importLiteralTerm(range.gte, prefixes, rangeBoundary);
  return importedRange;
};

export const importTerm = (term: Term|Range, isGraph: boolean, defaultGraphValue: string, prefixes: Prefixes, rangeBoundary: boolean = false): string|ImportedRange => {
  switch (term.termType) {
    case 'NamedNode':
      return prefixes.compactIri(term.value);
    case 'BlankNode':
      return '_:' + term.value;
    case 'Variable':
      return '?' + term.value;
    case 'DefaultGraph':
      return defaultGraphValue;
    case 'Literal':
      // When importing a Literal term, if rangeBoundary is true and thus
      // the terms comes from a pattern being used to query the database,
      // we want to match against all literals of the same kind
      // (numeric, datetimes, ...) rather than against literals of the same
      // exact datatype.
      if (rangeBoundary) {
        const value = importLiteralTerm(term, prefixes, rangeBoundary);
        return {gte: value, lte: value};
      }
      return importLiteralTerm(term, prefixes, rangeBoundary);
    case 'Range':
      return importRange(term, prefixes, rangeBoundary);
    default:
      // @ts-ignore
      throw new Error(`Unexpected termType: "${term.termType}".`);
  }
};

export const importQuad = (quad: Quad, defaultGraphValue: string, prefixes: Prefixes): ImportedQuad => {
  return {
    subject: importSimpleTerm(quad.subject, false, defaultGraphValue, prefixes, false),
    predicate: importSimpleTerm(quad.predicate, false, defaultGraphValue, prefixes, false),
    object: importSimpleTerm(quad.object, false, defaultGraphValue, prefixes, false),
    graph: importSimpleTerm(quad.graph, true, defaultGraphValue, prefixes, false),
  };
};

export const serializeImportedQuad = (quad: ImportedQuad): string => {
  return JSON.stringify(quad);
};

export const importPattern = (terms: Pattern, defaultGraph: string, prefixes: Prefixes): ImportedPattern => {
  const importedTerms: ImportedPattern = {};
  if (terms.subject) {
    importedTerms.subject = importTerm(terms.subject, false, defaultGraph, prefixes, true);
  }
  if (terms.predicate) {
    importedTerms.predicate = importTerm(terms.predicate, false, defaultGraph, prefixes, true);
  }
  if (terms.object) {
    importedTerms.object = importTerm(terms.object, false, defaultGraph, prefixes, true);
  }
  if (terms.graph) {
    importedTerms.graph = importTerm(terms.graph, true, defaultGraph, prefixes, true);
  }
  return importedTerms;
};
