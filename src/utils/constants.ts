
import type { TermName } from '../types/index.js';
import type { AbstractChainedBatchPutOptions, AbstractChainedBatchDelOptions } from 'abstract-level';

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

export const levelPutOpts: AbstractChainedBatchPutOptions<any, any, any> = {
  keyEncoding: 'utf8',
  valueEncoding: 'view',
};

export const levelDelOpts: AbstractChainedBatchDelOptions<any, any> = {
  keyEncoding: 'utf8',
};

export const emptyValue = new Uint8Array(0);
