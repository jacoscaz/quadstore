
'use strict';

const isFunction = (f) => {
  return typeof(f) === 'function';
};

module.exports.isFunction = isFunction;

const isObject = (o) => {
  return typeof(o) === 'object' && o !== null;
};

module.exports.isObject = isObject;

const isString = (s) => {
  return typeof(s) === 'string';
};

module.exports.isString = isString;

const isNumber = (n) => {
  return typeof(n) === 'number';
};

module.exports.isNumber = isNumber;

const isNil = (n) => {
  return n === null || n === undefined;
};

module.exports.isNil = isNil;

module.exports.isArray = Array.isArray;

const isBoolean = (b) => {
  return b === true || b === false;
};

module.exports.isBoolean = isBoolean;

module.exports.extend = Object.assign;

module.exports.flatMap = require('lodash.flatmap');
module.exports.mapValues = require('lodash.mapvalues');
