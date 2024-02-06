
import type { Literal } from '@rdfjs/types';
import type {InternalIndex, Pattern, Prefixes, IndexQuery, SerializedTerm} from '../types';

import * as xsd from './xsd';
import { encode } from './fpstring';
import { separator, boundary } from '../utils/constants';
import { blankNodeWriter, defaultGraphWriter, genericLiteralWriter, langStringLiteralWriter, namedNodeWriter,
         numericLiteralWriter, stringLiteralWriter } from './terms';

const serialized: SerializedTerm = {
  type: '',
  value: '',
  lengths: '',
};

const patternLiteralWriter = {
  write(term: Literal, prefixes: Prefixes) {
    if (term.language) {
      langStringLiteralWriter.write(term, serialized, prefixes);
      return;
    }
    if (term.datatype) {
      switch (term.datatype.value) {
        case xsd.string:
          stringLiteralWriter.write(term, serialized, prefixes);
          return;
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
          numericLiteralWriter.write(term, serialized, prefixes, true, encode(term.value));
          return;
        case xsd.dateTime:
          numericLiteralWriter.write(term, serialized, prefixes, true, encode(new Date(term.value).valueOf()));
          return;
        default:
          genericLiteralWriter.write(term, serialized, prefixes);
          return;
      }
    }
    stringLiteralWriter.write(term, serialized, prefixes);
    return;
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
          patternLiteralWriter.write(term.gt, prefixes);
          gt += serialized.value;
          gte = false;
        } else if (term.gte) {
          patternLiteralWriter.write(term.gte, prefixes);
          gt += serialized.value;
          gte = true;
        }
        if (term.lt) {
          patternLiteralWriter.write(term.lt, prefixes);
          lt += serialized.value;
          lte = false;
        } else if (term.lte) {
          patternLiteralWriter.write(term.lte, prefixes);
          lt += serialized.value;
          lte = true;
        }
        break;
      case 'Literal':
        didLiteral = true;
        patternLiteralWriter.write(term, prefixes);
        gt += serialized.value;
        gte = true;
        patternLiteralWriter.write(term, prefixes);
        lt += serialized.value;
        lte = true;
        break;
      case 'NamedNode':
        namedNodeWriter.write(term, serialized, prefixes);
        gt += serialized.value;
        gte = true;
        namedNodeWriter.write(term, serialized, prefixes);
        lt += serialized.value;
        lte = true;
        break;
      case 'BlankNode':
        blankNodeWriter.write(term, serialized, prefixes);
        gt += serialized.value;
        gte = true;
        blankNodeWriter.write(term, serialized, prefixes);
        lt += serialized.value;
        lte = true;
        break;
      case 'DefaultGraph':
        defaultGraphWriter.write(term, serialized, prefixes);
        gt += serialized.value;
        gte = true;
        defaultGraphWriter.write(term, serialized, prefixes);
        lt += serialized.value;
        lte = true;
        break;
      default:
        throw new Error(`Unsupported term type ${term.termType}`);
    }
    remaining -= 1;
    if (remaining > 0 && t < index.terms.length - 1) {
      gt += separator;
      lt += separator;
    }
  }
  if (lte) {
    if (didRange) {
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
