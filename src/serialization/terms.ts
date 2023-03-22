
import type { Prefixes, ReadingState, SerializedTerm, TermReader, TermWriter } from '../types';
import type { BlankNode, DataFactory, DefaultGraph, Literal, NamedNode } from 'rdf-js';

import * as xsd from './xsd';
import {padNumStart, sliceString} from './utils';
import {Term} from 'rdf-js';
import {separator} from '../utils/constants';
import {encode} from './fpstring';

export const namedNodeWriter: TermWriter<NamedNode, 'F'> = {
  write(node: NamedNode, serialized: SerializedTerm, prefixes: Prefixes) {
    const compactedIri = prefixes.compactIri(node.value);
    serialized.lengths = padNumStart(compactedIri.length);
    serialized.value = compactedIri;
  },
};

export const namedNodeReader: TermReader<NamedNode> = {
  read(key: string, state: ReadingState, factory: DataFactory, prefixes: Prefixes): NamedNode {
    const { keyOffset, lengthsOffset } = state;
    const valueLen = parseInt(sliceString(key, lengthsOffset, 4), 36);
    state.lengthsOffset += 4;
    state.keyOffset += valueLen;
    return factory.namedNode(prefixes.expandTerm(sliceString(key, keyOffset, valueLen)));
  },
};

export const blankNodeWriter: TermWriter<BlankNode, 'F'> = {
  write(node: BlankNode, serialized: SerializedTerm) {
    serialized.lengths = padNumStart(node.value.length);
    serialized.value = node.value;
  },
};

export const blankNodeReader: TermReader<BlankNode> = {
  read(key: string, state: ReadingState, factory: DataFactory): BlankNode {
    const { keyOffset, lengthsOffset } = state;
    const valueLen = parseInt(sliceString(key, lengthsOffset, 4), 36);
    state.lengthsOffset += 4;
    state.keyOffset += valueLen;
    return factory.blankNode(sliceString(key, keyOffset, valueLen));
  },
};

export const genericLiteralWriter: TermWriter<Literal, 'F'> = {
  write(node: Literal, serialized: SerializedTerm) {
    serialized.lengths = padNumStart(node.value.length) + padNumStart(node.datatype.value.length);
    serialized.value = node.datatype.value + separator + node.value;
  },
};

export const genericLiteralReader: TermReader<Literal> = {
  read(key: string, state: ReadingState, factory: DataFactory, prefixes: Prefixes): Literal {
    const { keyOffset, lengthsOffset } = state;
    const valueLen = parseInt(sliceString(key, lengthsOffset, 4), 36);
    const datatypeValueLen = parseInt(sliceString(key, lengthsOffset + 4, 4), 36);
    state.lengthsOffset += 8;
    state.keyOffset += valueLen + datatypeValueLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset, datatypeValueLen)),
    );
  },
}

export const stringLiteralWriter: TermWriter<Literal, 'F'> = {
  write(node: Literal, serialized: SerializedTerm) {
    serialized.lengths = padNumStart(node.value.length);
    serialized.value = node.value;
  },
};

export const stringLiteralReader: TermReader<Literal> = {
  read(key: string, state: ReadingState, factory: DataFactory): Literal {
    const { keyOffset, lengthsOffset } = state;
    const valueLen = parseInt(sliceString(key, lengthsOffset, 4), 36);
    state.lengthsOffset += 4;
    state.keyOffset += valueLen;
    return factory.literal(sliceString(key, keyOffset, valueLen));
  },
};

export const langStringLiteralWriter: TermWriter<Literal, 'F'> = {
  write(node: Literal, serialized: SerializedTerm) {
    serialized.lengths = padNumStart(node.value.length) + padNumStart(node.language.length);
    serialized.value = node.language + separator + node.value;
  },
};

export const langStringLiteralReader: TermReader<Literal> = {
  read(key: string, state: ReadingState, factory: DataFactory, prefixes: Prefixes): Literal {
    const { keyOffset, lengthsOffset } = state;
    const valueLen = parseInt(sliceString(key, lengthsOffset, 4), 36);
    const langCodeLen = parseInt(sliceString(key, lengthsOffset + 4, 4), 36);
    state.lengthsOffset += 8;
    state.keyOffset += valueLen + langCodeLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + langCodeLen + separator.length, valueLen),
      sliceString(key, keyOffset, langCodeLen),
    );
  },
}

export const numericLiteralWriter: TermWriter<Literal, 'T'> = {
  write(node: Literal, serialized: SerializedTerm, prefixes: Prefixes, rangeMode: boolean, encodedValue: string) {
    serialized.lengths = padNumStart(node.value.length) + padNumStart(node.datatype.value.length) + padNumStart(encodedValue.length);
    if (!rangeMode) {
      serialized.value = encodedValue + separator + node.datatype.value + separator + node.value;
    } else {
      serialized.value = encodedValue;
    }
  },
};

export const numericLiteralReader: TermReader<Literal> = {
  read(key: string, state: ReadingState, factory: DataFactory, prefixes: Prefixes): Literal {
    const { keyOffset, lengthsOffset } = state;
    const valueLen = parseInt(sliceString(key, lengthsOffset, 4), 36);
    const datatypeValueLen = parseInt(sliceString(key, lengthsOffset + 4, 4), 36);
    const numericValueLen = parseInt(sliceString(key, lengthsOffset + 8, 4), 36);
    state.lengthsOffset += 12;
    state.keyOffset += numericValueLen + datatypeValueLen + valueLen + (separator.length * 2);
    return factory.literal(
      sliceString(key, keyOffset + numericValueLen + separator.length + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset + numericValueLen + separator.length, datatypeValueLen)),
    );
  },
}

export const defaultGraphWriter: TermWriter<DefaultGraph, 'F'> = {
  write(node: DefaultGraph, serialized: SerializedTerm) {
    serialized.value = 'dg';
    serialized.lengths = '2';
  },
};

export const defaultGraphReader: TermReader<DefaultGraph> = {
  read(key: string, state: ReadingState, factory: DataFactory, prefixes: Prefixes): DefaultGraph {
    state.keyOffset += 2;
    state.lengthsOffset += 1;
    return factory.defaultGraph();
  },
};

export const termWriter: TermWriter<Term, 'F'> = {
  write(term: Term, serialized: SerializedTerm, prefixes: Prefixes) {
    switch (term.termType) {
      case 'NamedNode':
        serialized.type = '0';
        namedNodeWriter.write(term, serialized, prefixes);
        break;
      case 'BlankNode':
        serialized.type = '1';
        blankNodeWriter.write(term, serialized, prefixes);
        break;
      case 'DefaultGraph':
        serialized.type = '6';
        defaultGraphWriter.write(term, serialized, prefixes);
        break;
      case 'Literal':
        if (term.language) {
          serialized.type = '4';
          langStringLiteralWriter.write(term, serialized, prefixes);
        } else if (term.datatype) {
          switch (term.datatype.value) {
            case xsd.string:
              serialized.type = '3';
              stringLiteralWriter.write(term, serialized, prefixes);
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
              serialized.type = '5';
              numericLiteralWriter.write(term, serialized, prefixes, false, encode(term.value));
              break;
            case xsd.dateTime:
              serialized.type = '7';
              numericLiteralWriter.write(term, serialized, prefixes, false, encode(new Date(term.value).valueOf()));
              break;
            default:
              serialized.type = '2';
              genericLiteralWriter.write(term, serialized, prefixes);
          }
        } else {
          serialized.type = '3';
          stringLiteralWriter.write(term, serialized, prefixes);
        }
    }
  }
};

export const termReader: TermReader<Term> = {
  read(key: string, state: ReadingState, factory: DataFactory, prefixes: Prefixes) {
    let termValue;
    const encodedTermType = key.charAt(state.lengthsOffset);
    state.lengthsOffset += 1;
    switch (encodedTermType) {
      case '0':
        termValue = namedNodeReader.read(key, state, factory, prefixes);
        break;
      case '1':
        termValue = blankNodeReader.read(key, state, factory, prefixes);
        break;
      case '2':
        termValue = genericLiteralReader.read(key, state, factory, prefixes);
        break;
      case '3':
        termValue = stringLiteralReader.read(key, state, factory, prefixes);
        break;
      case '4':
        termValue = langStringLiteralReader.read(key, state, factory, prefixes);
        break;
      case '5':
        termValue = numericLiteralReader.read(key, state, factory, prefixes);
        break;
      case '6':
        termValue = defaultGraphReader.read(key, state, factory, prefixes);
        break;
      case '7':
        termValue = numericLiteralReader.read(key, state, factory, prefixes);
        break;
      default: throw new Error(`Unexpected encoded term type "${encodedTermType}"`);
    }
    return termValue;
  }
};
