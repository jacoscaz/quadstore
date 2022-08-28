
import type { Literal } from 'rdf-js';
import type { InternalIndex, Pattern, Prefixes, IndexQuery } from '../types/index.js';

import * as xsd from './xsd.js';
import { encode } from './fpstring.js';
import { separator, boundary } from '../utils/constants.js';
import { blankNodeWriter, defaultGraphWriter, genericLiteralWriter, langStringLiteralWriter, namedNodeWriter,
         numericLiteralWriter, stringLiteralWriter } from './terms.js';


const patternLiteralWriter = {
  write(term: Literal) {
    if (term.language) {
      return langStringLiteralWriter.write(undefined, 0, term, separator);
    }
    if (term.datatype) {
      switch (term.datatype.value) {
        case xsd.string:
          return stringLiteralWriter.write(undefined, 0, term);
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
          return numericLiteralWriter.write(undefined, 0, term, separator, encode(term.value), true);
        case xsd.dateTime:
          return numericLiteralWriter.write(undefined, 0, term, separator, encode(new Date(term.value).valueOf()), true);
        default:
          return genericLiteralWriter.write(undefined, 0, term, separator);
      }
    }
    return stringLiteralWriter.write(undefined, 0, term);
  }
};

export const writePattern = (pattern: Pattern, index: InternalIndex, prefixes: Prefixes): IndexQuery|null => {
  let gt = index.prefix;
  let lt = index.prefix;
  let gte = true;
  let lte = true;
  let didRange = false;
  let didLiteral = false;
  let remaining = Object.entries(pattern).filter(([termName, term]) => term).length;
  if (remaining === 0) {
    lt += boundary;
    return { gt, lt, gte, lte, order: index.terms, index };
  }
  let t = 0;
  for (; t < index.terms.length && remaining > 0; t += 1) {
    const term = pattern[index.terms[t]];
    if (!term) {
      return null;
    }
    if (didRange || didLiteral) {
      return null;
    }
    switch (term.termType) {
      case 'Range':
        didRange = true;
        if (term.gt) {
          gt += patternLiteralWriter.write(term.gt);
          gte = false;
        } else if (term.gte) {
          gt += patternLiteralWriter.write(term.gte);
          gte = true;
        }
        if (term.lt) {
          lt += patternLiteralWriter.write(term.lt);
          lte = false;
        } else if (term.lte) {
          lt += patternLiteralWriter.write(term.lte);
          lte = true;
        }
        break;
      case 'Literal':
        didLiteral = true;
        gt += patternLiteralWriter.write(term);
        gte = true;
        lt += patternLiteralWriter.write(term);
        lte = true;
        break;
      case 'NamedNode':
        gt += namedNodeWriter.write(undefined, 0, term, prefixes);
        gte = true;
        lt += namedNodeWriter.write(undefined, 0, term, prefixes);
        lte = true;
        break;
      case 'BlankNode':
        gt += blankNodeWriter.write(undefined, 0, term);
        gte = true;
        lt += blankNodeWriter.write(undefined, 0, term);
        lte = true;
        break;
      case 'DefaultGraph':
        gt += defaultGraphWriter.write(undefined, 0, term);
        gte = true;
        lt += defaultGraphWriter.write(undefined, 0, term);
        lte = true;
        break;
    }
    remaining -= 1;
    if (remaining > 0 && t < index.terms.length - 1) {
      gt += separator;
      lt += separator;
    }
  }
  if (lte) {
    if (didRange || didLiteral) {
      lt += boundary;
    } else {
      lt += separator + boundary;
    }
  } else {
    lt += separator;
  }
  if (gte) {
    if (!didRange && !didLiteral) {
      gt += separator;
    }
  } else {
    if (didRange || didLiteral) {
      gt += boundary;
    } else {
      gt += separator + boundary;
    }
  }
  return { gt, lt, gte, lte, order: index.terms.slice(didRange ? t - 1 : 1), index };
};
