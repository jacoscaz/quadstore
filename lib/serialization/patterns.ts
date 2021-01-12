import {Literal} from 'rdf-js';
import {
  blankNodeWriter, defaultGraphWriter,
  genericLiteralWriter,
  langStringLiteralWriter,
  namedNodeWriter,
  numericLiteralWriter,
  stringLiteralWriter
} from './terms';
import * as xsd from './xsd';
import {encode} from './fpstring';
import {Pattern, Prefixes, TermName} from '../types';
import {copyBufferIntoBuffer, copyBuffer} from './utils';

const patternLiteralWriter = {
  write(separator: string, term: Literal) {
    if (term.language) {
      return langStringLiteralWriter.write(undefined, undefined, term, separator);
    }
    if (term.datatype) {
      switch (term.datatype.value) {
        case xsd.string:
          return stringLiteralWriter.write(undefined, undefined, term);
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
          return numericLiteralWriter.write(undefined, undefined, term, separator, encode(term.value), true);
        case xsd.dateTime:
          return numericLiteralWriter.write(undefined, undefined, term, separator, encode(new Date(term.value).valueOf()), true);
        default:
          return genericLiteralWriter.write(undefined, undefined, term, separator);
      }
    }
    return stringLiteralWriter.write(undefined, undefined, term);
  }
};

export const writePattern = (
  pattern: Pattern,
  prefix: string,
  separator: string,
  boundary: string,
  termNames: TermName[],
  prefixes: Prefixes,
): ({ gt: string, gte: boolean, lt: string, lte: boolean }|false) => {
  let gt = prefix;
  let lt = prefix;
  let gte = true;
  let lte = true;
  let didRangeOrLiteral = false;
  let remaining = Object.entries(pattern).filter(([termName, term]) => term).length;
  if (remaining === 0) {
    lt += boundary;
    return { gt, lt, gte, lte };
  }
  for (let t = 0; t < termNames.length && remaining > 0; t += 1) {
    const term = pattern[termNames[t]];
    if (!term) {
      return false;
    }
    if (didRangeOrLiteral) {
      return false;
    }
    switch (term.termType) {
      case 'Range':
        didRangeOrLiteral = true;
        if (term.gt) {
          gt += patternLiteralWriter.write(separator, term.gt);
          gte = false;
        } else if (term.gte) {
          gt += patternLiteralWriter.write(separator, term.gte);
          gte = true;
        }
        if (term.lt) {
          lt += patternLiteralWriter.write(separator, term.lt);
          lte = false;
        } else if (term.lte) {
          lt += patternLiteralWriter.write(separator, term.lte);
          lte = true;
        }
        break;
      case 'Literal':
        didRangeOrLiteral = true;
        gt += patternLiteralWriter.write(separator, term);
        gte = true;
        lt += patternLiteralWriter.write(separator, term);
        lte = true;
        break;
      case 'NamedNode':
        gt += namedNodeWriter.write(undefined, undefined, term, prefixes);
        gte = true;
        lt += namedNodeWriter.write(undefined, undefined, term, prefixes);
        lte = true;
        break;
      case 'BlankNode':
        gt += blankNodeWriter.write(undefined, undefined, term);
        gte = true;
        lt += blankNodeWriter.write(undefined, undefined, term);
        lte = true;
        break;
      case 'DefaultGraph':
        gt += defaultGraphWriter.write(undefined, undefined, term);
        gte = true;
        lt += defaultGraphWriter.write(undefined, undefined, term);
        lte = true;
        break;
    }
    remaining -= 1;
    if (remaining > 0 && t < termNames.length - 1) {
      gt += separator;
      lt += separator;
    }
  }

  if (lte) {
    if (didRangeOrLiteral) {
      lt += boundary;
    } else {
      lt += separator + boundary;
    }
  } else {
    lt += separator;
  }
  if (gte) {
    if (!didRangeOrLiteral) {
      gt += separator;
    }
  } else {
    if (didRangeOrLiteral) {
      gt += boundary;
    } else {
      gt += separator + boundary;
    }
  }
  return { gt, lt, gte, lte };
};
