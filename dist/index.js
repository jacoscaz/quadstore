"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RdfStore = exports.QuadStore = void 0;
const quadstore_1 = __importDefault(require("./lib/quadstore"));
exports.QuadStore = quadstore_1.default;
const rdfstore_1 = __importDefault(require("./lib/rdfstore"));
exports.RdfStore = rdfstore_1.default;
//# sourceMappingURL=index.js.map