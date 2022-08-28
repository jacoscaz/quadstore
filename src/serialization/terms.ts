
import type { Prefixes } from '../types/index.js';
import type { BlankNode, DataFactory, DefaultGraph, Literal, NamedNode } from 'rdf-js';

import * as xsd from './xsd.js';
import { sliceString } from './utils.js';
import {Term} from 'rdf-js';
import {separator} from '../utils/constants.js';
import {encode} from './fpstring.js';

export const namedNodeWriter = {
  writtenValueLength: 1,
  write(value: Uint16Array|undefined, valueOffset: number, node: NamedNode, prefixes: Prefixes) {
    const compactedIri = prefixes.compactIri(node.value);
    if (value) {
      value[valueOffset] = compactedIri.length;
    }
    return compactedIri;
  },
};

export const namedNodeReader = {
  readValueLength: 1,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory, prefixes: Prefixes): NamedNode {
    const valueLen = value[valueOffset];
    this.readKeyChars = valueLen;
    return factory.namedNode(prefixes.expandTerm(sliceString(key, keyOffset, valueLen)));
  },
};

export const blankNodeWriter = {
  writtenValueLength: 1,
  write(value: Uint16Array|undefined, valueOffset: number, node: BlankNode) {
    if (value) {
      value[valueOffset] = node.value.length;
    }
    return node.value;
  },
};

export const blankNodeReader = {
  readValueLength: 1,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory): BlankNode {
    const valueLen = value[valueOffset];
    this.readKeyChars = valueLen;
    return factory.blankNode(sliceString(key, keyOffset, valueLen));
  },
};

export const genericLiteralWriter = {
  writtenValueLength: 2,
  write(value: Uint16Array|undefined, valueOffset: number, node: Literal, separator: string) {
    if (value) {
      value[valueOffset] = node.value.length;
      value[valueOffset + 1] = node.datatype.value.length;
    }
    return node.datatype.value + separator + node.value;
  },
};

export const genericLiteralReader = {
  readValueLength: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value[valueOffset];
    const datatypeValueLen = value[valueOffset + 1];
    this.readKeyChars = valueLen + datatypeValueLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset, datatypeValueLen)),
    );
  },
}

export const stringLiteralWriter = {
  writtenValueLength: 1,
  write(value: Uint16Array|undefined, valueOffset: number, node: Literal) {
    if (value) {
      value[valueOffset] = node.value.length;
    }
    return node.value;
  },
};

export const stringLiteralReader = {
  readValueLength: 1,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory): Literal {
    const valueLen = value[valueOffset];
    this.readKeyChars = valueLen;
    return factory.literal(sliceString(key, keyOffset, valueLen));
  },
};

export const langStringLiteralWriter = {
  writtenValueLength: 2,
  write(value: Uint16Array|undefined, valueOffset: number, node: Literal, separator: string) {
    if (value) {
      value[valueOffset] = node.value.length;
      value[valueOffset + 1] = node.language.length;
    }
    return node.language + separator + node.value;
  },
};

export const langStringLiteralReader = {
  readValueLength: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value[valueOffset];
    const langCodeLen = value[valueOffset + 1];
    this.readKeyChars = valueLen + langCodeLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + langCodeLen + separator.length, valueLen),
      sliceString(key, keyOffset, langCodeLen),
    );
  },
}

export const numericLiteralWriter = {
  writtenValueLength: 3,
  write(value: Uint16Array|undefined, valueOffset: number, node: Literal, separator: string, encodedNumericValue: string, rangeMode: boolean) {
    if (value) {
      value[valueOffset] = node.value.length;
      value[valueOffset + 1] = node.datatype.value.length;
      value[valueOffset + 2] = encodedNumericValue.length;
    }
    let ret = encodedNumericValue;
    if (!rangeMode) {
      ret += separator + node.datatype.value + separator + node.value;
    }
    return ret;
  },
};

export const numericLiteralReader = {
  readValueLength: 3,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value[valueOffset];
    const datatypeValueLen = value[valueOffset + 1];
    const numericValueLen = value[valueOffset + 2];
    this.readKeyChars = numericValueLen + datatypeValueLen + valueLen + (separator.length * 2);
    return factory.literal(
      sliceString(key, keyOffset + numericValueLen + separator.length + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset + numericValueLen + separator.length, datatypeValueLen)),
    );
  },
}

export const defaultGraphWriter = {
  writtenValueLength: 1,
  write(value: Uint16Array|undefined, valueOffset: number, node: DefaultGraph) {
    if (value) {
      value[valueOffset] = 2;
    }
    return 'dg';
  },
};

export const defaultGraphReader = {
  readValueLength: 1,
  readKeyChars: 2,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, factory: DataFactory): DefaultGraph {
    return factory.defaultGraph();
  },
};

export const termWriter = {
  writtenValueLength: 0,
  write(value: Uint16Array | undefined, baseValueOffset: number, term: Term, prefixes: Prefixes): string {
    let ret = '';
    let valueOffset = baseValueOffset;
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
    this.writtenValueLength = valueOffset - baseValueOffset;
    return ret;
  }
};

export const termReader = {
  readKeyChars: 0,
  readValueLength: 0,
  read(key: string, baseKeyOffset: number, value: Uint16Array, baseValueOffset: number, factory: DataFactory, prefixes: Prefixes) {
    let keyOffset = baseKeyOffset;
    let valueOffset = baseValueOffset;
    let termValue;
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
    this.readKeyChars = keyOffset - baseKeyOffset;
    this.readValueLength = valueOffset - baseValueOffset;
    return termValue;
  }
};
