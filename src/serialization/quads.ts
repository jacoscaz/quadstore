
import type { DataFactory, Term } from 'rdf-js';
import type { Prefixes, Quad, TermName } from '../types';

import { separator } from '../utils/constants';
import { termReader, termWriter } from './terms';

export const quadWriter = {
  writtenValueLength: 0,
  write(prefix: string, value: Uint16Array|undefined, baseValueOffset: number, quad: Quad, termNames: TermName[], prefixes: Prefixes) {
    let ret = prefix;
    let valueOffset = baseValueOffset;
    for (let t = 0, term; t < termNames.length; t += 1) {
      term = quad[termNames[t]];
      ret += termWriter.write(value, valueOffset, term, prefixes) + separator;
      valueOffset += termWriter.writtenValueLength;
    }
    this.writtenValueLength = valueOffset - baseValueOffset;
    return ret;
  },
};

export const quadReader = {
  subject: null,
  predicate: null,
  object: null,
  graph: null,
  read(key: string, keyOffset: number, value: Uint16Array, valueOffset: number, termNames: TermName[], factory: DataFactory, prefixes: Prefixes): Quad {
    for (let t = 0, termName; t < termNames.length; t += 1) {
      termName = termNames[t];
      // @ts-ignore
      this[termName] = termReader.read(key, keyOffset, value, valueOffset, factory, prefixes);
      keyOffset += termReader.readKeyChars + separator.length;
      valueOffset += termReader.readValueLength;
    }
    // @ts-ignore
    return factory.quad(this.subject, this.predicate, this.object, this.graph);
  },
};
