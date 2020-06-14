"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapValues = exports.groupBy = exports.flatMap = exports.extend = exports.isArray = exports.isBoolean = exports.isNil = exports.isNumber = exports.isString = exports.isSimpleObject = exports.isObject = exports.isFunction = void 0;
const lodash_flatmap_1 = __importDefault(require("lodash.flatmap"));
exports.flatMap = lodash_flatmap_1.default;
const lodash_groupby_1 = __importDefault(require("lodash.groupby"));
exports.groupBy = lodash_groupby_1.default;
const lodash_mapvalues_1 = __importDefault(require("lodash.mapvalues"));
exports.mapValues = lodash_mapvalues_1.default;
exports.isFunction = (f) => {
    return typeof (f) === 'function';
};
exports.isObject = (o) => {
    return typeof (o) === 'object' && o !== null;
};
exports.isSimpleObject = (o) => {
    return exports.isObject(o) && o.constructor === Object;
};
exports.isString = (s) => {
    return typeof (s) === 'string';
};
exports.isNumber = (n) => {
    return typeof (n) === 'number';
};
exports.isNil = (n) => {
    return n === null || n === undefined;
};
exports.isBoolean = (b) => {
    return b === true || b === false;
};
exports.isArray = Array.isArray;
exports.extend = Object.assign;
