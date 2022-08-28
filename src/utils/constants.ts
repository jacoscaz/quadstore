
import { TermName } from '../types/index.js';

export const emptyObject: { [key: string]: any } = {};

export const boundary = '\uDBFF\uDFFF';
export const separator = '\u0000\u0000';

export const termNames: TermName[] = [
  'subject',
  'predicate',
  'object',
  'graph',
];

export const defaultIndexes: TermName[][] = [
  ['subject', 'predicate', 'object', 'graph'],
  ['object', 'graph', 'subject', 'predicate'],
  ['graph', 'subject', 'predicate', 'object'],
  ['subject', 'object', 'predicate', 'graph'],
  ['predicate', 'object', 'graph', 'subject'],
  ['graph', 'predicate', 'object', 'subject'],
];
