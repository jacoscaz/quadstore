
import type { Prefixes } from '../types';
import type { BlankNode, DataFactory, DefaultGraph, Literal, NamedNode } from 'rdf-js';

import { sliceString } from './utils';

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
