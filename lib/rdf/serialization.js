"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.importSearchStage = exports.importSimplePattern = exports.importPattern = exports.exportBinding = exports.exportQuad = exports.importQuad = exports.importTerm = exports.importRange = exports.importSimpleTerm = exports.exportTerm = exports.importLiteralTerm = exports.exportLiteralTerm = void 0;
var _ = require("../utils/lodash");
var xsd = 'http://www.w3.org/2001/XMLSchema#';
var xsdString = xsd + 'string';
var xsdInteger = xsd + 'integer';
var xsdDouble = xsd + 'double';
var xsdDateTime = xsd + 'dateTime';
var fpstring = require('./fpstring');
var xsdBoolean = xsd + 'boolean';
var RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
exports.exportLiteralTerm = function (term, dataFactory) {
    var _a = term.split('^'), encoding = _a[1], datatype = _a[2], value = _a[3], language = _a[4];
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
exports.importLiteralTerm = function (term, rangeBoundary) {
    if (rangeBoundary === void 0) { rangeBoundary = false; }
    if (term.language) {
        return "^^" + xsdString + "^" + term.value + "^" + term.language;
    }
    if (!term.datatype || term.datatype.value === xsdString) {
        return "^^" + term.datatype.value + "^" + term.value + "^";
    }
    switch (term.datatype.value) {
        case xsdInteger:
        case xsdDouble:
            if (rangeBoundary) {
                return "^number:" + fpstring(term.value.slice(1, -1));
            }
            return "^number:" + fpstring(term.value.slice(1, -1)) + "^" + term.datatype.value + "^" + term.value + "^";
        case xsdDateTime:
            var timestamp = new Date(term.value.slice(1, -1)).valueOf();
            if (rangeBoundary) {
                return "^datetime:" + fpstring(timestamp);
            }
            return "^datetime:" + fpstring(timestamp) + "^" + term.datatype.value + "^" + term.value + "^";
        default:
            return "^^" + term.datatype.value + "^" + term.value + "^";
    }
};
exports.exportTerm = function (term, isGraph, defaultGraphValue, dataFactory) {
    if (!term) {
        throw new Error("Nil term \"" + term + "\". Cannot export.");
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
                throw new Error("Invalid graph term \"" + term + "\" (graph cannot be a literal).");
            }
            return exports.exportLiteralTerm(term, dataFactory);
        default:
            return dataFactory.namedNode(term);
    }
};
exports.importSimpleTerm = function (term, isGraph, defaultGraphValue) {
    if (!term) {
        if (isGraph) {
            return defaultGraphValue;
        }
        throw new Error("Nil non-graph term, cannot import.");
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
            // @ts-ignore
            throw new Error("Unexpected termType: \"" + term.termType + "\".");
    }
};
exports.importRange = function (range, rangeBoundary) {
    if (rangeBoundary === void 0) { rangeBoundary = false; }
    var importedRange = {};
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
exports.importTerm = function (term, isGraph, defaultGraphValue, rangeBoundary) {
    if (rangeBoundary === void 0) { rangeBoundary = false; }
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
                // @ts-ignore
                throw new Error("Unexpected termType: \"" + term.termType + "\".");
        }
    }
    else {
        throw new Error("Unexpected type of \"term\" argument.");
    }
};
exports.importQuad = function (quad, defaultGraphValue) {
    return {
        subject: exports.importSimpleTerm(quad.subject, false, defaultGraphValue),
        predicate: exports.importSimpleTerm(quad.predicate, false, defaultGraphValue),
        object: exports.importSimpleTerm(quad.object, false, defaultGraphValue),
        graph: exports.importSimpleTerm(quad.graph, true, defaultGraphValue)
    };
};
var exportQuadSubject = function (term, dataFactory) {
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
var exportQuadPredicate = function (term, dataFactory) {
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
var exportQuadObject = function (term, dataFactory) {
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
var exportQuadGraph = function (term, defaultGraphValue, dataFactory) {
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
exports.exportQuad = function (quad, defaultGraphValue, dataFactory) {
    return dataFactory.quad(exportQuadSubject(quad.subject, dataFactory), exportQuadPredicate(quad.predicate, dataFactory), exportQuadObject(quad.object, dataFactory), exportQuadGraph(quad.graph, defaultGraphValue, dataFactory));
};
exports.exportBinding = function (binding, defaultGraphValue, dataFactory) {
    return _.mapValues(binding, function (term) { return exports.exportTerm(term, false, defaultGraphValue, dataFactory); });
};
exports.importPattern = function (terms, defaultGraph) {
    var importedTerms = {};
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
exports.importSimplePattern = function (terms, defaultGraph) {
    var importedPattern = {};
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
exports.importSearchStage = function (stage, defaultGraph) {
    switch (stage.type) {
        case "bgp" /* BGP */:
            return __assign(__assign({}, stage), { pattern: exports.importSimplePattern(stage.pattern, defaultGraph) });
        case "lt" /* LT */:
        case "lte" /* LTE */:
        case "gt" /* GT */:
        case "gte" /* GTE */:
            return {
                type: stage.type,
                args: stage.args.map(function (arg) { return exports.importSimpleTerm(arg, false, defaultGraph); })
            };
    }
};
