
'use strict';

const isFunction = (f: any): boolean => {
  return typeof(f) === 'function';
};

module.exports.isFunction = isFunction;

const isObject = (o: any): boolean => {
  return typeof(o) === 'object' && o !== null;
};

module.exports.isObject = isObject;

const isSimpleObject = (o: any): boolean => {
  return isObject(o) && o.constructor === Object;
};

module.exports.isSimpleObject = isSimpleObject;

const isString = (s: any): boolean => {
  return typeof(s) === 'string';
};

module.exports.isString = isString;

const isNumber = (n: any): boolean => {
  return typeof(n) === 'number';
};

module.exports.isNumber = isNumber;

const isNil = (n: any): boolean => {
  return n === null || n === undefined;
};

module.exports.isNil = isNil;

module.exports.isArray = Array.isArray;

const isBoolean = (b: any): boolean => {
  return b === true || b === false;
};

module.exports.isBoolean = isBoolean;

module.exports.extend = Object.assign;

module.exports.flatMap = require('lodash.flatmap');
module.exports.groupBy = require('lodash.groupBy');
module.exports.mapValues = require('lodash.mapvalues');
