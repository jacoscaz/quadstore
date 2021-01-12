import {Prefixes, Quad, TermName} from '../types';
import {
  blankNodeReader,
  blankNodeWriter, defaultGraphReader,
  defaultGraphWriter, genericLiteralReader, genericLiteralWriter, langStringLiteralReader,
  langStringLiteralWriter, namedNodeReader,
  namedNodeWriter, numericLiteralReader, numericLiteralWriter, stringLiteralReader,
  stringLiteralWriter
} from './terms';
import * as xsd from './xsd';
import {encode} from './fpstring';
import {DataFactory} from 'rdf-js';

export const quadWriter = {
  writtenValueBytes: 0,
  write(prefix: string, value: Buffer, separator: string, quad: Quad, termNames: TermName[], prefixes: Prefixes) {
    let ret = prefix;
    let valueOffset = 0;
    for (let t = 0, term; t < termNames.length; t += 1) {
      term = quad[termNames[t]];
      switch (term.termType) {
        case 'NamedNode':
          value.writeUInt16LE(0, valueOffset);
          valueOffset += 2;
          ret += namedNodeWriter.write(value, valueOffset, term, prefixes);
          valueOffset += namedNodeWriter.writtenValueBytes;
          break;
        case 'BlankNode':
          value.writeUInt16LE(1, valueOffset);
          valueOffset += 2;
          ret += blankNodeWriter.write(value, valueOffset, term);
          valueOffset += blankNodeWriter.writtenValueBytes;
          break;
        case 'DefaultGraph':
          value.writeUInt16LE(6, valueOffset);
          valueOffset += 2;
          ret += defaultGraphWriter.write(value, valueOffset, term);
          valueOffset += defaultGraphWriter.writtenValueBytes;
          break;
        case 'Literal':
          if (term.language) {
            value.writeUInt16LE(4, valueOffset);
            valueOffset += 2;
            ret += langStringLiteralWriter.write(value, valueOffset, term, separator);
            valueOffset += langStringLiteralWriter.writtenValueBytes;
          } else if (term.datatype) {
            switch (term.datatype.value) {
              case xsd.string:
                value.writeUInt16LE(3, valueOffset);
                valueOffset += 2;
                ret += stringLiteralWriter.write(value, valueOffset, term);
                valueOffset += stringLiteralWriter.writtenValueBytes;
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
                value.writeUInt16LE(5, valueOffset);
                valueOffset += 2;
                ret += numericLiteralWriter.write(value, valueOffset, term, separator, encode(term.value), false);
                valueOffset += numericLiteralWriter.writtenValueBytes;
                break;
              case xsd.dateTime:
                value.writeUInt16LE(5, valueOffset);
                valueOffset += 2;
                ret += numericLiteralWriter.write(value, valueOffset, term, separator, encode(new Date(term.value).valueOf()), false);
                valueOffset += numericLiteralWriter.writtenValueBytes;
                break;
              default:
                value.writeUInt16LE(2, valueOffset);
                valueOffset += 2;
                ret += genericLiteralWriter.write(value, valueOffset, term, separator);
                valueOffset += genericLiteralWriter.writtenValueBytes;
            }
          } else {
            value.writeUInt16LE(3, valueOffset);
            valueOffset += 2;
            ret += stringLiteralWriter.write(value, valueOffset, term);
            valueOffset += stringLiteralWriter.writtenValueBytes;
          }
      }
      ret += separator;
    }
    this.writtenValueBytes = valueOffset;
    return ret;
  },
};

export const quadReader = {
  subject: null,
  predicate: null,
  object: null,
  graph: null,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, separator: string, termNames: TermName[], factory: DataFactory, prefixes: Prefixes): Quad {
    for (let t = 0, termName, termValue; t < termNames.length; t += 1) {
      termName = termNames[t];
      const encodedTermType = value.readUInt16LE(valueOffset);
      valueOffset += 2;
      switch (encodedTermType) {
        case 0:
          termValue = namedNodeReader.read(key, keyOffset, value, valueOffset, factory, prefixes);
          // @ts-ignore
          keyOffset += namedNodeReader.readKeyChars;
          valueOffset += namedNodeReader.readValueBytes;
          break;
        case 1:
          termValue = blankNodeReader.read(key, keyOffset, value, valueOffset, factory);
          // @ts-ignore
          keyOffset += blankNodeReader.readKeyChars;
          valueOffset += blankNodeReader.readValueBytes;
          break;
        case 2:
          termValue = genericLiteralReader.read(key, keyOffset, value, valueOffset, factory, separator);
          // @ts-ignore
          keyOffset += genericLiteralReader.readKeyChars;
          valueOffset += genericLiteralReader.readValueBytes;
          break;
        case 3:
          termValue = stringLiteralReader.read(key, keyOffset, value, valueOffset, factory);
          // @ts-ignore
          keyOffset += stringLiteralReader.readKeyChars;
          valueOffset += stringLiteralReader.readValueBytes;
          break;
        case 4:
          termValue = langStringLiteralReader.read(key, keyOffset, value, valueOffset, factory, separator);
          // @ts-ignore
          keyOffset += langStringLiteralReader.readKeyChars;
          valueOffset += langStringLiteralReader.readValueBytes;
          break;
        case 5:
          termValue = numericLiteralReader.read(key, keyOffset, value, valueOffset, factory, separator);
          // @ts-ignore
          keyOffset += numericLiteralReader.readKeyChars;
          valueOffset += numericLiteralReader.readValueBytes;
          break;
        case 6:
          termValue = defaultGraphReader.read(key, keyOffset, value, valueOffset, factory);
          // @ts-ignore
          keyOffset += defaultGraphReader.readKeyChars;
          valueOffset += defaultGraphReader.readValueBytes;
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
