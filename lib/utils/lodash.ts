
import flatMap from 'lodash.flatmap';
import mapValues from 'lodash.mapvalues';

export const isFunction = (f: any): boolean => {
  return typeof(f) === 'function';
};

export const isObject = (o: any): boolean => {
  return typeof(o) === 'object' && o !== null;
};

export const isSimpleObject = (o: any): boolean => {
  return isObject(o) && o.constructor === Object;
};

export const isString = (s: any): boolean => {
  return typeof(s) === 'string';
};

export const isNumber = (n: any): boolean => {
  return typeof(n) === 'number';
};

export const isNil = (n: any): boolean => {
  return n === null || n === undefined;
};

export const isBoolean = (b: any): boolean => {
  return b === true || b === false;
};

export const isArray = Array.isArray;
export const extend = Object.assign;

export { flatMap }
export { mapValues }
