"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSFilterSearchStageType = exports.TSSearchStageType = exports.TSResultType = void 0;
var TSResultType;
(function (TSResultType) {
    TSResultType["QUADS"] = "quads";
    TSResultType["BINDINGS"] = "bindings";
    TSResultType["APPROXIMATE_SIZE"] = "approximate_size";
})(TSResultType = exports.TSResultType || (exports.TSResultType = {}));
var TSSearchStageType;
(function (TSSearchStageType) {
    TSSearchStageType["BGP"] = "bgp";
    TSSearchStageType["LT"] = "lt";
    TSSearchStageType["LTE"] = "lte";
    TSSearchStageType["GT"] = "gt";
    TSSearchStageType["GTE"] = "gte";
})(TSSearchStageType = exports.TSSearchStageType || (exports.TSSearchStageType = {}));
var TSFilterSearchStageType;
(function (TSFilterSearchStageType) {
    TSFilterSearchStageType["GT"] = "gt";
    TSFilterSearchStageType["GTE"] = "gte";
    TSFilterSearchStageType["LT"] = "lt";
    TSFilterSearchStageType["LTE"] = "lte";
})(TSFilterSearchStageType = exports.TSFilterSearchStageType || (exports.TSFilterSearchStageType = {}));
