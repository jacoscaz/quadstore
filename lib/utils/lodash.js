"use strict";
exports.__esModule = true;
exports.mapValues = exports.groupBy = exports.flatMap = exports.extend = exports.isArray = exports.isBoolean = exports.isNil = exports.isNumber = exports.isString = exports.isSimpleObject = exports.isObject = exports.isFunction = void 0;
var lodash_flatmap_1 = require("lodash.flatmap");
exports.flatMap = lodash_flatmap_1["default"];
var lodash_groupby_1 = require("lodash.groupby");
exports.groupBy = lodash_groupby_1["default"];
var lodash_mapvalues_1 = require("lodash.mapvalues");
exports.mapValues = lodash_mapvalues_1["default"];
exports.isFunction = function (f) {
    return typeof (f) === 'function';
};
exports.isObject = function (o) {
    return typeof (o) === 'object' && o !== null;
};
exports.isSimpleObject = function (o) {
    return exports.isObject(o) && o.constructor === Object;
};
exports.isString = function (s) {
    return typeof (s) === 'string';
};
exports.isNumber = function (n) {
    return typeof (n) === 'number';
};
exports.isNil = function (n) {
    return n === null || n === undefined;
};
exports.isBoolean = function (b) {
    return b === true || b === false;
};
exports.isArray = Array.isArray;
exports.extend = Object.assign;
