
import type {DataFactory} from 'rdf-js';
import type { Prefixes, Quad, TermName } from '../types';

import * as xsd from './xsd';
import { encode } from './fpstring';
import { separator } from '../utils/constants';
import { blankNodeReader, blankNodeWriter, defaultGraphReader, defaultGraphWriter, genericLiteralReader,
         genericLiteralWriter, langStringLiteralReader, langStringLiteralWriter, namedNodeReader, namedNodeWriter,
         numericLiteralReader, numericLiteralWriter, stringLiteralReader, stringLiteralWriter } from './terms';

export const quadWriter = {
  writtenValueLength: 0,
  write(prefix: string, value: Uint16Array|undefined, quad: Quad, termNames: TermName[], prefixes: Prefixes) {
    let ret = prefix;
    let valueOffset = 0;
    for (let t = 0, term; t < termNames.length; t += 1) {
      term = quad[termNames[t]];
      switch (term.termType) {
        case 'NamedNode':
          if (value) {
            value[valueOffset] = 0;
          }
          valueOffset += 1;
          ret += namedNodeWriter.write(value, valueOffset, term, prefixes);
          valueOffset += namedNodeWriter.writtenValueLength;
          break;
        case 'BlankNode':
          if (value) {
            value[valueOffset] = 1;
          }
          valueOffset += 1;
          ret += blankNodeWriter.write(value, valueOffset, term);
          valueOffset += blankNodeWriter.writtenValueLength;
          break;
        case 'DefaultGraph':
          if (value) {
            value[valueOffset] = 6;
          }
          valueOffset += 1;
          ret += defaultGraphWriter.write(value, valueOffset, term);
          valueOffset += defaultGraphWriter.writtenValueLength;
          break;
        case 'Literal':
          if (term.language) {
            if (value) {
              value[valueOffset] = 4;
            }
            valueOffset += 1;
            ret += langStringLiteralWriter.write(value, valueOffset, term, separator);
            valueOffset += langStringLiteralWriter.writtenValueLength;
          } else if (term.datatype) {
            switch (term.datatype.value) {
              case xsd.string:
                if (value) {
                  value[valueOffset] = 3;
                }
                valueOffset += 1;
                ret += stringLiteralWriter.write(value, valueOffset, term);
                valueOffset += stringLiteralWriter.writtenValueLength;
                break;
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
                if (value) {
                  value[valueOffset] = 5;
                }
                valueOffset += 1;
                ret += numericLiteralWriter.write(value, valueOffset, term, separator, encode(term.value), false);
                valueOffset += numericLiteralWriter.writtenValueLength;
                break;
              case xsd.dateTime:
                if (value) {
                  value[valueOffset] = 5;
                }
                valueOffset += 1;
                ret += numericLiteralWriter.write(value, valueOffset, term, separator, encode(new Date(term.value).valueOf()), false);
                valueOffset += numericLiteralWriter.writtenValueLength;
                break;
              default:
                if (value) {
                  value[valueOffset] = 2;
                }
                valueOffset += 1;
                ret += genericLiteralWriter.write(value, valueOffset, term, separator);
                valueOffset += genericLiteralWriter.writtenValueLength;
            }
          } else {
            if (value) {
              value[valueOffset] = 3;
            }
            valueOffset += 1;
            ret += stringLiteralWriter.write(value, valueOffset, term);
            valueOffset += stringLiteralWriter.writtenValueLength;
          }
      }
      ret += separator;
    }
    this.writtenValueLength = valueOffset;
    return ret;
  },
};

export const quadReader = {
  subject: null,
  predicate: null,
  object: null,
  graph: null,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, termNames: TermName[], factory: DataFactory, prefixes: Prefixes): Quad {
    for (let t = 0, termName, termValue; t < termNames.length; t += 1) {
      termName = termNames[t];
      const encodedTermType = value[valueOffset];
      valueOffset += 1;
      switch (encodedTermType) {
        case 0:
          termValue = namedNodeReader.read(key, keyOffset, value, valueOffset, factory, prefixes);
          // @ts-ignore
          keyOffset += namedNodeReader.readKeyChars;
          valueOffset += namedNodeReader.readValueLength;
          break;
        case 1:
          termValue = blankNodeReader.read(key, keyOffset, value, valueOffset, factory);
          // @ts-ignore
          keyOffset += blankNodeReader.readKeyChars;
          valueOffset += blankNodeReader.readValueLength;
          break;
        case 2:
          termValue = genericLiteralReader.read(key, keyOffset, value, valueOffset, factory, separator);
          // @ts-ignore
          keyOffset += genericLiteralReader.readKeyChars;
          valueOffset += genericLiteralReader.readValueLength;
          break;
        case 3:
          termValue = stringLiteralReader.read(key, keyOffset, value, valueOffset, factory);
          // @ts-ignore
          keyOffset += stringLiteralReader.readKeyChars;
          valueOffset += stringLiteralReader.readValueLength;
          break;
        case 4:
          termValue = langStringLiteralReader.read(key, keyOffset, value, valueOffset, factory, separator);
          // @ts-ignore
          keyOffset += langStringLiteralReader.readKeyChars;
          valueOffset += langStringLiteralReader.readValueLength;
          break;
        case 5:
          termValue = numericLiteralReader.read(key, keyOffset, value, valueOffset, factory, separator);
          // @ts-ignore
          keyOffset += numericLiteralReader.readKeyChars;
          valueOffset += numericLiteralReader.readValueLength;
          break;
        case 6:
          termValue = defaultGraphReader.read(key, keyOffset, value, valueOffset, factory);
          // @ts-ignore
          keyOffset += defaultGraphReader.readKeyChars;
          valueOffset += defaultGraphReader.readValueLength;
          break;
        default: throw new Error(`Unexpected encoded term type "${encodedTermType}"`);
      }
      // @ts-ignore
      this[termName] = termValue;
      keyOffset += separator.length;
    }
    // @ts-ignore
    return factory.quad(this.subject, this.predicate, this.object, this.graph);
  },
};
