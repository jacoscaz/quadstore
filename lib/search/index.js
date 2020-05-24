"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchStream = void 0;
const p_iteration_1 = __importDefault(require("p-iteration"));
const enums_1 = __importDefault(require("../utils/enums"));
const sort_iterator_1 = __importDefault(require("./iterators/sort-iterator"));
const nested_loop_join_iterator_1 = __importDefault(require("./iterators/nested-loop-join-iterator"));
const quadstore_1 = __importDefault(require("../quadstore"));
const getBindingsIterator = async (store, parsedPattern) => {
    const { variables, matchTerms, termsToVarsMap } = parsedPattern;
    const results = await quadstore_1.default.prototype.getStream.call(store, matchTerms, {});
    const sorting = results.sorting.reduce((acc, termName) => {
        if (termsToVarsMap[termName]) {
            acc.push(termsToVarsMap[termName]);
        }
        return acc;
    }, []);
    let iterator = results.iterator.transform({ transform: function (quad, done) {
            const binding = {};
            for (const term in termsToVarsMap) {
                if (termsToVarsMap.hasOwnProperty(term)) {
                    binding[termsToVarsMap[term]] = quad[term];
                }
            }
            this._push(binding);
            done();
        } });
    // iterator = filterFns.reduce((it, filterFn) => it.filter(filterFn), iterator);
    return { type: enums_1.default.resultType.BINDINGS, iterator, sorting, variables };
};
/**
 *
 * @param store
 * @param {GetStreamResults} prev
 * @param {ParsedPattern} next
 * @returns {Promise<GetStreamResults>}
 */
const nestedLoopJoin = async (store, prev, next) => {
    const nextCommonVarsToTermsMap = {};
    const nextAdditionalSortingTerms = [];
    for (const variableName in next.variables) {
        if (next.varsToTermsMap.hasOwnProperty(variableName)) {
            if (prev.variables.hasOwnProperty(variableName)) {
                nextCommonVarsToTermsMap[variableName] = next.varsToTermsMap[variableName];
            }
            else {
                nextAdditionalSortingTerms.push(variableName);
            }
        }
    }
    const joinedSorting = [...prev.sorting, ...nextAdditionalSortingTerms];
    const nextSorting = joinedSorting.filter(variableName => next.variables.hasOwnProperty(variableName));
    const getInnerIterator = async (outerBinding) => {
        const innerMatchTerms = { ...next.matchTerms };
        for (const variableName in nextCommonVarsToTermsMap) {
            innerMatchTerms[nextCommonVarsToTermsMap[variableName]] = outerBinding[variableName];
        }
        const { iterator } = await getBindingsIterator(store, {
            matchTerms: innerMatchTerms,
            termsToVarsMap: next.termsToVarsMap,
            varsToTermsMap: next.varsToTermsMap,
            variables: next.variables,
        });
        const comparator = quadstore_1.default.prototype._getQuadComparator.call(store, nextSorting);
        return new sort_iterator_1.default(iterator, comparator);
    };
    const mergeItems = (firstBinding, secondBinding) => ({
        ...firstBinding,
        ...secondBinding,
    });
    return {
        iterator: new nested_loop_join_iterator_1.default(prev.iterator, getInnerIterator, mergeItems),
        variables: { ...prev.variables, ...next.variables },
        sorting: joinedSorting,
        type: enums_1.default.resultType.BINDINGS,
    };
};
const objectContains = (outer, inner) => {
    for (const key in inner) {
        if (inner.hasOwnProperty(key)) {
            if (!outer.hasOwnProperty(key)) {
                return false;
            }
        }
    }
    return true;
};
/**
 *
 * @param {string[]}termNames
 * @param pattern
 * @returns {ParsedPattern}
 */
const parsePattern = (termNames, pattern) => {
    const variables = {};
    const matchTerms = {};
    const varsToTermsMap = {};
    const termsToVarsMap = {};
    termNames.forEach((termName) => {
        if (pattern[termName]) {
            if (pattern[termName].charAt(0) === '?') {
                variables[pattern[termName]] = true;
                varsToTermsMap[pattern[termName]] = termName;
                termsToVarsMap[termName] = pattern[termName];
            }
            else {
                matchTerms[termName] = pattern[termName];
            }
        }
    });
    return { variables, matchTerms, termsToVarsMap, varsToTermsMap };
};
const parseFilter = (termNames, filter) => {
    const variables = {};
    filter.args.forEach((arg) => {
        if (arg.charAt(0) === '?') {
            variables[arg] = true;
        }
    });
    return { ...filter, variables };
};
// const applyFilterToPattern = (store: QuadStore, termNames: string[], parsedFilter: any, parsedPattern: ParsedPattern) => {
//   const variableNames = Object.keys(parsedFilter.variables);
//   if (variableNames.length === 1) {
//     const matchTerms = {
//       [parsedPattern.variables[variableNames[0]]]: filtering.getFilterTermRange(parsedFilter),
//     };
//     parsedPattern.filterMatchTerms = store._mergeMatchTerms(parsedPattern.filterMatchTerms, matchTerms, termNames);
//   }
//   const filterFn = filtering.compileFilter(parsedFilter);
//   parsedPattern.filterFns.push(filterFn);
//   return parsedPattern;
// };
exports.searchStream = async (store, patterns, filters) => {
    const termNames = store._getTermNames();
    let parsedFilters = filters.map(filter => parseFilter(termNames, filter));
    let parsedPatterns = patterns.map(pattern => parsePattern(termNames, pattern));
    // parsedFilters.forEach((parsedFilter) => {
    //   parsedPatterns.forEach((parsedPattern) => {
    //     if (objectContains(parsedPattern.variables, parsedFilter.variables)) {
    //       applyFilterToPattern(store, termNames, parsedFilter, parsedPattern);
    //     }
    //   });
    // });
    return await p_iteration_1.default.reduce(parsedPatterns.slice(1), async (prev, next) => {
        return await nestedLoopJoin(store, prev, next);
    }, await getBindingsIterator(store, parsedPatterns[0]));
};
