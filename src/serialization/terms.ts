
import type { Prefixes } from '../types';
import type { BlankNode, DataFactory, DefaultGraph, Literal, NamedNode } from 'rdf-js';

import { sliceString } from './utils';

export const namedNodeWriter = {
  writtenValueBytes: 2,
  write(value: DataView|undefined, valueOffset: number, node: NamedNode, prefixes: Prefixes) {
    const compactedIri = prefixes.compactIri(node.value);
    if (value) {
      value.setUint16(valueOffset, compactedIri.length, true);
    }
    return compactedIri;
  },
};

export const namedNodeReader = {
  readValueBytes: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory, prefixes: Prefixes): NamedNode {
    const valueLen = value.getUint16(valueOffset, true);
    this.readKeyChars = valueLen;
    return factory.namedNode(prefixes.expandTerm(sliceString(key, keyOffset, valueLen)));
  },
};

export const blankNodeWriter = {
  writtenValueBytes: 2,
  write(value: DataView|undefined, valueOffset: number, node: BlankNode) {
    if (value) {
      value.setUint16(valueOffset, node.value.length, true);
    }
    return node.value;
  },
};

export const blankNodeReader = {
  readValueBytes: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory): BlankNode {
    const valueLen = value.getUint16(valueOffset, true);
    this.readKeyChars = valueLen;
    return factory.blankNode(sliceString(key, keyOffset, valueLen));
  },
};

export const genericLiteralWriter = {
  writtenValueBytes: 4,
  write(value: DataView|undefined, valueOffset: number, node: Literal, separator: string) {
    if (value) {
      value.setUint16(valueOffset, node.value.length, true);
      value.setUint16(valueOffset + 2, node.datatype.value.length,  true);
    }
    return node.datatype.value + separator + node.value;
  },
};

export const genericLiteralReader = {
  readValueBytes: 4,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value.getUint16(valueOffset, true);
    const datatypeValueLen = value.getUint16(valueOffset + 2, true);
    this.readKeyChars = valueLen + datatypeValueLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset, datatypeValueLen)),
    );
  },
}

export const stringLiteralWriter = {
  writtenValueBytes: 2,
  write(value: DataView|undefined, valueOffset: number, node: Literal) {
    if (value) {
      value.setUint16(valueOffset, node.value.length, true);
    }
    return node.value;
  },
};

export const stringLiteralReader = {
  readValueBytes: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory): Literal {
    const valueLen = value.getUint16(valueOffset, true);
    this.readKeyChars = valueLen;
    return factory.literal(sliceString(key, keyOffset, valueLen));
  },
};

export const langStringLiteralWriter = {
  writtenValueBytes: 4,
  write(value: DataView|undefined, valueOffset: number, node: Literal, separator: string) {
    if (value) {
      value.setUint16(valueOffset, node.value.length, true);
      value.setUint16(valueOffset + 2, node.language.length, true);
    }
    return node.language + separator + node.value;
  },
};

export const langStringLiteralReader = {
  readValueBytes: 4,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value.getUint16(valueOffset, true);
    const langCodeLen = value.getUint16(valueOffset + 2, true);
    this.readKeyChars = valueLen + langCodeLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + langCodeLen + separator.length, valueLen),
      sliceString(key, keyOffset, langCodeLen),
    );
  },
}

export const numericLiteralWriter = {
  writtenValueBytes: 6,
  write(value: DataView|undefined, valueOffset: number, node: Literal, separator: string, encodedNumericValue: string, rangeMode: boolean) {
    if (value) {
      value.setUint16(valueOffset, node.value.length, true);
      value.setUint16(valueOffset + 2, node.datatype.value.length, true);
      value.setUint16(valueOffset + 4, encodedNumericValue.length, true);
    }
    let ret = encodedNumericValue;
    if (!rangeMode) {
      ret += separator + node.datatype.value + separator + node.value;
    }
    return ret;
  },
};

export const numericLiteralReader = {
  readValueBytes: 6,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value.getUint16(valueOffset, true);
    const datatypeValueLen = value.getUint16(valueOffset + 2, true);
    const numericValueLen = value.getUint16(valueOffset + 4, true);
    this.readKeyChars = numericValueLen + datatypeValueLen + valueLen + (separator.length * 2);
    return factory.literal(
      sliceString(key, keyOffset + numericValueLen + separator.length + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset + numericValueLen + separator.length, datatypeValueLen)),
    );
  },
}

export const defaultGraphWriter = {
  writtenValueBytes: 2,
  write(value: DataView|undefined, valueOffset: number, node: DefaultGraph) {
    if (value) {
      value.setUint16(valueOffset, 2, true);
    }
    return 'dg';
  },
};

export const defaultGraphReader = {
  readValueBytes: 2,
  readKeyChars: 2,
  read(key: string, keyOffset: number, value: DataView, valueOffset: number, factory: DataFactory): DefaultGraph {
    return factory.defaultGraph();
  },
};
