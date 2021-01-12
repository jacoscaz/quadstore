
import {BlankNode, DataFactory, DefaultGraph, Literal, NamedNode} from 'rdf-js';
import {copyBufferIntoBuffer, sliceBuffer, sliceString} from './utils';
import {Prefixes} from '../types';

export const namedNodeWriter = {
  writtenValueBytes: 2,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: NamedNode, prefixes: Prefixes) {
    const compactedIri = prefixes.compactIri(node.value);
    if (value) {
      value.writeUInt16LE(compactedIri.length, valueOffset);
    }
    return compactedIri;
  },
};

export const namedNodeReader = {
  readValueBytes: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory, prefixes: Prefixes): NamedNode {
    const valueLen = value.readUInt16LE(valueOffset);
    this.readKeyChars = valueLen;
    return factory.namedNode(prefixes.expandTerm(sliceString(key, keyOffset, valueLen)));
  },
};

export const blankNodeWriter = {
  writtenValueBytes: 2,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: BlankNode) {
    if (value) {
      value.writeUInt16LE(node.value.length, valueOffset);
    }
    return node.value;
  },
};

export const blankNodeReader = {
  readValueBytes: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory): BlankNode {
    const valueLen = value.readUInt16LE(valueOffset);
    this.readKeyChars = valueLen;
    return factory.blankNode(sliceString(key, keyOffset, valueLen));
  },
};

export const genericLiteralWriter = {
  writtenValueBytes: 4,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: Literal, separator: string) {
    if (value) {
      value.writeUInt16LE(node.value.length, <number>valueOffset);
      value.writeUInt16LE(node.datatype.value.length, <number>valueOffset + 2);
    }
    return node.datatype.value + separator + node.value;
  },
};

export const genericLiteralReader = {
  readValueBytes: 4,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value.readUInt16LE(valueOffset);
    const datatypeValueLen = value.readUInt16LE(valueOffset + 2);
    this.readKeyChars = valueLen + datatypeValueLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset, datatypeValueLen)),
    );
  },
}

export const stringLiteralWriter = {
  writtenValueBytes: 2,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: Literal) {
    if (value) {
      value.writeUInt16LE(node.value.length, valueOffset);
    }
    return node.value;
  },
};

export const stringLiteralReader = {
  readValueBytes: 2,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory): Literal {
    const valueLen = value.readUInt16LE(valueOffset);
    this.readKeyChars = valueLen;
    return factory.literal(sliceString(key, keyOffset, valueLen));
  },
};

export const langStringLiteralWriter = {
  writtenValueBytes: 4,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: Literal, separator: string) {
    if (value) {
      value.writeUInt16LE(node.value.length, valueOffset);
      value.writeUInt16LE(node.language.length, <number>valueOffset + 2);
    }
    return node.language + separator + node.value;
  },
};

export const langStringLiteralReader = {
  readValueBytes: 4,
  readKeyChars: 0,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value.readUInt16LE(valueOffset);
    const langCodeLen = value.readUInt16LE(valueOffset + 2);
    this.readKeyChars = valueLen + langCodeLen + separator.length;
    return factory.literal(
      sliceString(key, keyOffset + langCodeLen + separator.length, valueLen),
      sliceString(key, keyOffset, langCodeLen),
    );
  },
}

export const numericLiteralWriter = {
  writtenValueBytes: 6,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: Literal, separator: string, encodedNumericValue: string, rangeMode: boolean) {
    if (value) {
      value.writeUInt16LE(node.value.length, valueOffset);
      value.writeUInt16LE(node.datatype.value.length, <number>valueOffset + 2);
      value.writeUInt16LE(encodedNumericValue.length, <number>valueOffset + 4);
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
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory, separator: string): Literal {
    const valueLen = value.readUInt16LE(valueOffset);
    const datatypeValueLen = value.readUInt16LE(valueOffset + 2);
    const numericValueLen = value.readUInt16LE(valueOffset + 4);
    this.readKeyChars = numericValueLen + datatypeValueLen + valueLen + (separator.length * 2);
    return factory.literal(
      sliceString(key, keyOffset + numericValueLen + separator.length + datatypeValueLen + separator.length, valueLen),
      factory.namedNode(sliceString(key, keyOffset + numericValueLen + separator.length, datatypeValueLen)),
    );
  },
}

export const defaultGraphWriter = {
  writtenValueBytes: 2,
  write(value: Buffer|undefined, valueOffset: number|undefined, node: DefaultGraph) {
    if (value) {
      value.writeUInt16LE(2, valueOffset);
    }
    return 'dg';
  },
};

export const defaultGraphReader = {
  readValueBytes: 2,
  readKeyChars: 2,
  read(key: string, keyOffset: number, value: Buffer, valueOffset: number, factory: DataFactory): DefaultGraph {
    return factory.defaultGraph();
  },
};
