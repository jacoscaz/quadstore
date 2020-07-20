"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importSearchStage = exports.importSimplePattern = exports.importPattern = exports.exportBinding = exports.exportQuad = exports.importQuad = exports.importTerm = exports.importRange = exports.importSimpleTerm = exports.exportTerm = exports.importLiteralTerm = exports.exportLiteralTerm = void 0;
const _ = __importStar(require("../utils/lodash"));
const xsd = 'http://www.w3.org/2001/XMLSchema#';
const xsdString = xsd + 'string';
const xsdInteger = xsd + 'integer';
const xsdDouble = xsd + 'double';
const xsdDateTime = xsd + 'dateTime';
const fpstring = require('./fpstring');
const xsdBoolean = xsd + 'boolean';
const RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
exports.exportLiteralTerm = (term, dataFactory) => {
    const [, encoding, datatype, value, language] = term.split('^');
    switch (datatype) {
        case xsdString:
            if (language !== '') {
                return dataFactory.literal(value, language);
            }
            return dataFactory.literal(value);
        default:
            return dataFactory.literal(value, dataFactory.namedNode(datatype));
    }
};
exports.importLiteralTerm = (term, rangeBoundary = false) => {
    if (term.language) {
        return `^^${xsdString}^${term.value}^${term.language}`;
    }
    if (!term.datatype || term.datatype.value === xsdString) {
        return `^^${term.datatype.value}^${term.value}^`;
    }
    switch (term.datatype.value) {
        case xsdInteger:
        case xsdDouble:
            if (rangeBoundary) {
                return `^number:${fpstring(term.value.slice(1, -1))}`;
            }
            return `^number:${fpstring(term.value.slice(1, -1))}^${term.datatype.value}^${term.value}^`;
        case xsdDateTime:
            const timestamp = new Date(term.value.slice(1, -1)).valueOf();
            if (rangeBoundary) {
                return `^datetime:${fpstring(timestamp)}`;
            }
            return `^datetime:${fpstring(timestamp)}^${term.datatype.value}^${term.value}^`;
        default:
            return `^^${term.datatype.value}^${term.value}^`;
    }
};
exports.exportTerm = (term, isGraph, defaultGraphValue, dataFactory) => {
    if (!term) {
        throw new Error(`Nil term "${term}". Cannot export.`);
    }
    if (term === defaultGraphValue) {
        return dataFactory.defaultGraph();
    }
    switch (term[0]) {
        case '_':
            return dataFactory.blankNode(term.substr(2));
        case '?':
            if (dataFactory.variable) {
                return dataFactory.variable(term.substr(1));
            }
            throw new Error('DataFactory does not support variables');
        case '^':
            if (isGraph) {
                throw new Error(`Invalid graph term "${term}" (graph cannot be a literal).`);
            }
            return exports.exportLiteralTerm(term, dataFactory);
        default:
            return dataFactory.namedNode(term);
    }
};
exports.importSimpleTerm = (term, isGraph, defaultGraphValue) => {
    if (!term) {
        if (isGraph) {
            return defaultGraphValue;
        }
        throw new Error(`Nil non-graph term, cannot import.`);
    }
    switch (term.termType) {
        case 'NamedNode':
            return term.value;
        case 'BlankNode':
            return '_:' + term.value;
        case 'Variable':
            return '?' + term.value;
        case 'DefaultGraph':
            return defaultGraphValue;
        case 'Literal':
            return exports.importLiteralTerm(term, false);
        default:
            throw new Error(`Unexpected termType: "${term.termType}".`);
    }
};
exports.importRange = (range, rangeBoundary = false) => {
    const importedRange = {};
    if (range.lt)
        importedRange.lt = exports.importLiteralTerm(range.lt, rangeBoundary);
    if (range.lte)
        importedRange.lte = exports.importLiteralTerm(range.lte, rangeBoundary);
    if (range.gt)
        importedRange.gt = exports.importLiteralTerm(range.gt, rangeBoundary);
    if (range.gte)
        importedRange.gte = exports.importLiteralTerm(range.gte, rangeBoundary);
    return importedRange;
};
exports.importTerm = (term, isGraph, defaultGraphValue, rangeBoundary = false) => {
    if ('gt' in term || 'gte' in term || 'lt' in term || 'lte' in term) {
        return exports.importRange(term, rangeBoundary);
    }
    else if ('termType' in term) {
        switch (term.termType) {
            case 'NamedNode':
                return term.value;
            case 'BlankNode':
                return '_:' + term.value;
            case 'Variable':
                return '?' + term.value;
            case 'DefaultGraph':
                return defaultGraphValue;
            case 'Literal':
                return exports.importLiteralTerm(term, rangeBoundary);
            default:
                throw new Error(`Unexpected termType: "${term.termType}".`);
        }
    }
    else {
        throw new Error(`Unexpected type of "term" argument.`);
    }
};
exports.importQuad = (quad, defaultGraphValue) => {
    return {
        subject: exports.importSimpleTerm(quad.subject, false, defaultGraphValue),
        predicate: exports.importSimpleTerm(quad.predicate, false, defaultGraphValue),
        object: exports.importSimpleTerm(quad.object, false, defaultGraphValue),
        graph: exports.importSimpleTerm(quad.graph, true, defaultGraphValue),
    };
};
const exportQuadSubject = (term, dataFactory) => {
    switch (term[0]) {
        case '_':
            return dataFactory.blankNode(term.substr(2));
        case '?':
            if (dataFactory.variable) {
                return dataFactory.variable(term.substr(1));
            }
            throw new Error('DataFactory does not support variables');
        case '^':
            throw new Error('No literals as subject');
        default:
            return dataFactory.namedNode(term);
    }
};
const exportQuadPredicate = (term, dataFactory) => {
    switch (term[0]) {
        case '_':
            throw new Error('No blank nodes as predicates');
        case '?':
            if (dataFactory.variable) {
                return dataFactory.variable(term.substr(1));
            }
            throw new Error('DataFactory does not support variables');
        case '^':
            throw new Error('No literals as predicates');
        default:
            return dataFactory.namedNode(term);
    }
};
const exportQuadObject = (term, dataFactory) => {
    switch (term[0]) {
        case '_':
            return dataFactory.blankNode(term.substr(2));
        case '?':
            if (dataFactory.variable) {
                return dataFactory.variable(term.substr(1));
            }
            throw new Error('DataFactory does not support variables');
        case '^':
            return exports.exportLiteralTerm(term, dataFactory);
        default:
            return dataFactory.namedNode(term);
    }
};
const exportQuadGraph = (term, defaultGraphValue, dataFactory) => {
    if (term === defaultGraphValue) {
        return dataFactory.defaultGraph();
    }
    switch (term[0]) {
        case '_':
            return dataFactory.blankNode(term.substr(2));
        case '?':
            if (dataFactory.variable) {
                return dataFactory.variable(term.substr(1));
            }
            throw new Error('DataFactory does not support variables');
        case '^':
            throw new Error('No literals as graphs');
        default:
            return dataFactory.namedNode(term);
    }
};
exports.exportQuad = (quad, defaultGraphValue, dataFactory) => {
    return dataFactory.quad(exportQuadSubject(quad.subject, dataFactory), exportQuadPredicate(quad.predicate, dataFactory), exportQuadObject(quad.object, dataFactory), exportQuadGraph(quad.graph, defaultGraphValue, dataFactory));
};
exports.exportBinding = (binding, defaultGraphValue, dataFactory) => {
    return _.mapValues(binding, (term) => exports.exportTerm(term, false, defaultGraphValue, dataFactory));
};
exports.importPattern = (terms, defaultGraph) => {
    const importedTerms = {};
    if (terms.subject) {
        importedTerms.subject = exports.importSimpleTerm(terms.subject, false, defaultGraph);
    }
    if (terms.predicate) {
        importedTerms.predicate = exports.importSimpleTerm(terms.predicate, false, defaultGraph);
    }
    if (terms.object) {
        importedTerms.object = exports.importTerm(terms.object, false, defaultGraph, true);
    }
    if (terms.graph) {
        importedTerms.graph = exports.importSimpleTerm(terms.graph, true, defaultGraph);
    }
    return importedTerms;
};
exports.importSimplePattern = (terms, defaultGraph) => {
    const importedPattern = {};
    if (terms.subject) {
        importedPattern.subject = exports.importSimpleTerm(terms.subject, false, defaultGraph);
    }
    if (terms.predicate) {
        importedPattern.predicate = exports.importSimpleTerm(terms.predicate, false, defaultGraph);
    }
    if (terms.object) {
        importedPattern.object = exports.importSimpleTerm(terms.object, false, defaultGraph);
    }
    if (terms.graph) {
        importedPattern.graph = exports.importSimpleTerm(terms.graph, true, defaultGraph);
    }
    return importedPattern;
};
exports.importSearchStage = (stage, defaultGraph) => {
    switch (stage.type) {
        case "bgp":
            return { ...stage, pattern: exports.importSimplePattern(stage.pattern, defaultGraph) };
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            return {
                type: stage.type,
                args: stage.args.map(arg => exports.importSimpleTerm(arg, false, defaultGraph)),
            };
    }
};
//# sourceMappingURL=serialization.js.map