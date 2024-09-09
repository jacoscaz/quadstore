
import type { Quad, Term } from '@rdfjs/types';

import { expect } from 'chai';
import { termNames } from '../../dist/esm/utils/constants.js';

export const toBeTrue = (value: any) => {
  expect(value).to.be.true;
};

export const toBeFalse = (value: any) => {
  expect(value).to.be.false;
};

export const toBeAnArray = (value: any, length?: number) => {
  expect(value).to.be.an('array');
  if (typeof length === 'number') {
    expect(value).to.have.length(length);
  }
};

export const toBeAnObject = (value: any) => {
  expect(value).to.be.an('object');
};

export const toBeAString = (value: any) => {
  expect(value).to.be.a('string');
};

export const toBeATerm = (value: any) => {
  expect(value).to.be.an('object');
  expect(value).to.have.property('termType');
  expect(value.termType).to.be.a('string');
};

export const toBeAQuad = (value: any) => {
  expect(value).to.be.an('object');
  termNames.forEach((termName) => {
    expect(value).to.have.property(termName);
    toBeATerm(value[termName]);
  });
};

export const toBeAFiniteNumber = (value: any) => {
  expect(value).to.be.a('number');
  expect(value).not.to.be.NaN;
  expect(value).not.to.equal(Infinity);
  expect(value).not.to.equal(-Infinity);
};

export const toBeLessThanOrEqualTo = (value: any, compare: number) => {
  expect(value).not.to.be.greaterThan(compare);
};

export const toStrictlyEqual = (value: any, compare: any) => {
  expect(value).to.equal(compare);
};

export const toBeAQuadArray = (value: any, length?: number) => {
  expect(value).to.be.an('array');
  if (typeof length === 'number') {
    expect(value).to.have.length(length);
  }
  for (let i = 0, l = value.length; i < l; i += 1) {
    toBeAQuad(value[i]);
  }
};

export const toEqualTerm = (value: any, expected: Term) => {
  toBeATerm(value);
  expect(value.termType).to.equal(expected.termType);
  expect(value.value).to.equal(expected.value);
  if (expected.termType === 'Literal') {
    expect(value.language).to.equal(expected.language);
    if (expected.datatype) {
      toEqualTerm(value.datatype, expected.datatype);
    }
  }
};

export const toNotEqualTerm = (value: any, expected: Term): undefined => {
  toBeATerm(value);
  if (value.termType !== expected.termType) {
    return;
  }
  if (value.value !== expected.value) {
    return;
  }
  if (expected.termType === 'Literal') {
    if (expected.language && value.language !== expected.language) {
      return;
    }
    if (expected.datatype) {
      return toNotEqualTerm(value.datatype, expected.datatype);
    }
  }
  throw new Error(`expected ${value} not to be equal to ${expected}`);
};

export const toEqualQuad = (value: any, expected: Quad) => {
  toBeAQuad(value);
  toEqualTerm(value.subject, expected.subject);
  toEqualTerm(value.predicate, expected.predicate);
  toEqualTerm(value.object, expected.object);
  toEqualTerm(value.graph, expected.graph);
};

export const equalsQuadArray = (value: any, expected: Quad[]) => {
  toBeAnArray(value);
  toStrictlyEqual(value.length, expected.length);
  for (let i = 0, l = expected.length; i < l; i += 1) {
    toEqualQuad(value[i], expected[i]);
  }
};

export const arrayToStartWith = (arr: any[], start: any[]) => {
  for (let i = 0, l = start.length; i < l; i += 1) {
    expect(arr[i]).to.equal(start[i]);
  }
};

export const arrayToHaveLength = (arr: any[], length: number) => {
  expect(arr).to.have.length(length);
};

export const toBeInstanceOf = <T>(value: any, clss: new (...args : any[]) => T) => {
  expect(value).to.be.instanceOf(clss);
};

export const toEqualUint8Array = (value: any, expected: Uint8Array) => {
  expect(value).to.be.an('Uint8Array');
  expect(value).to.have.length(expected.length);
  for (let i = 0, l = expected.length; i < l; i += 1) {
    expect(value[i]).to.equal(expected[i]);
  }
};
