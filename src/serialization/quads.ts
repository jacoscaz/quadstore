
import type {DataFactory, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Term} from 'rdf-js';
import type {Prefixes, Quad, SerializedTerm, TermName} from '../types';

import { separator } from '../utils/constants';
import { termReader, termWriter } from './terms';
import {padNumStart} from './utils';

type TwoStepsQuadWriter = Record<TermName, SerializedTerm> & {
  ingest(quad: Quad, prefixes: Prefixes): TwoStepsQuadWriter;
  write(prefix: string, termNames: TermName[]): string;
};

export const twoStepsQuadWriter: TwoStepsQuadWriter = {
  subject: { type: '', value: '', lengths: '' },
  predicate: { type: '', value: '', lengths: '' },
  object: { type: '', value: '', lengths: '' },
  graph: { type: '', value: '', lengths: '' },
  ingest(quad: Quad, prefixes: Prefixes) {
    termWriter.write(quad.subject, this.subject, prefixes);
    termWriter.write(quad.predicate, this.predicate, prefixes);
    termWriter.write(quad.object, this.object, prefixes);
    termWriter.write(quad.graph, this.graph, prefixes);
    return this;
  },
  write(prefix: string, termNames: TermName[]) {
    let key = prefix;
    let lengths = '';
    for (let t = 0, term; t < termNames.length; t += 1) {
      term = this[termNames[t]];
      key += term.value + separator;
      lengths += term.type + term.lengths;
    }
    return key + lengths + padNumStart(lengths.length);
  },
};

type QuadReader = Record<TermName, Term | null>
  & { keyOffset: number; lengthsOffset: number; }
  & { read(key: string, keyOffset: number, termNames: TermName[], factory: DataFactory, prefixes: Prefixes): Quad; }
  ;

export const quadReader: QuadReader = {
  subject: null,
  predicate: null,
  object: null,
  graph: null,
  keyOffset: 0,
  lengthsOffset: 0,
  read(key: string, keyOffset: number, termNames: TermName[], factory: DataFactory, prefixes: Prefixes): Quad {
    this.lengthsOffset = key.length - parseInt(key.slice(-4), 36) - 4;
    this.keyOffset = keyOffset;
    for (let t = 0, termName; t < termNames.length; t += 1) {
      termName = termNames[t];
      this[termName] = termReader.read(key, this, factory, prefixes);
      this.keyOffset += separator.length;
    }
    return factory.quad(
      this.subject! as Quad_Subject,
      this.predicate! as Quad_Predicate,
      this.object! as Quad_Object,
      this.graph! as Quad_Graph,
    );
  },
};
