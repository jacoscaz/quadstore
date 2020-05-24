"use strict";
const filterType = {
    GT: 'gt',
    GTE: 'gte',
    LT: 'lt',
    LTE: 'lte',
};
module.exports.filterType = filterType;
const iteratorPropertyName = {
    SPARQL_RESULT_TYPE: 'sparql-result-type',
    SORT: 'sort',
};
module.exports.iteratorPropertyName = iteratorPropertyName;
const resultType = {
    BINDINGS: 'bindings',
    QUADS: 'quads',
    BOOLEAN: 'boolean',
    ERROR: 'error',
    APPROX_SIZE: 'approximateSize',
};
module.exports.resultType = resultType;
