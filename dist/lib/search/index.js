"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchStream = void 0;
const p_iteration_1 = __importDefault(require("p-iteration"));
const utils_1 = require("../utils");
const filtering_1 = require("./filtering");
const sort_iterator_1 = __importDefault(require("./iterators/sort-iterator"));
const nested_loop_join_iterator_1 = __importDefault(require("./iterators/nested-loop-join-iterator"));
const quadstore_1 = __importDefault(require("../quadstore"));
const getBindingsIterator = async (store, parsedPattern) => {
    const { variables, pattern, termsToVarsMap } = parsedPattern;
    const results = await quadstore_1.default.prototype.getStream.call(store, pattern, {});
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
    return { type: "bindings", iterator, sorting, variables };
};
const nestedLoopJoin = async (store, prevResult, nextStage) => {
    const nextCommonVarsToTermsMap = {};
    const nextAdditionalSortingTerms = [];
    for (const variableName in nextStage.variables) {
        if (nextStage.varsToTermsMap.hasOwnProperty(variableName)) {
            if (prevResult.variables.hasOwnProperty(variableName)) {
                nextCommonVarsToTermsMap[variableName] = nextStage.varsToTermsMap[variableName];
            }
            else {
                nextAdditionalSortingTerms.push(variableName);
            }
        }
    }
    const joinedSorting = [...prevResult.sorting, ...nextAdditionalSortingTerms];
    const nextSorting = joinedSorting.filter(variableName => nextStage.variables.hasOwnProperty(variableName));
    const getInnerIterator = async (outerBinding) => {
        const innerPattern = { ...nextStage.pattern };
        for (const variableName in nextCommonVarsToTermsMap) {
            innerPattern[nextCommonVarsToTermsMap[variableName]] = outerBinding[variableName];
        }
        const { iterator } = await getBindingsIterator(store, {
            type: "bgp",
            optional: false,
            pattern: innerPattern,
            termsToVarsMap: nextStage.termsToVarsMap,
            varsToTermsMap: nextStage.varsToTermsMap,
            variables: nextStage.variables,
        });
        const comparator = quadstore_1.default.prototype._getQuadComparator.call(store, nextSorting);
        return new sort_iterator_1.default(iterator, comparator);
    };
    const mergeItems = (firstBinding, secondBinding) => ({
        ...firstBinding,
        ...secondBinding,
    });
    return {
        iterator: new nested_loop_join_iterator_1.default(prevResult.iterator, getInnerIterator, mergeItems),
        variables: { ...prevResult.variables, ...nextStage.variables },
        sorting: joinedSorting,
        type: "bindings",
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
const parseBgpSearchStage = (stage) => {
    const variables = {};
    const pattern = {};
    const varsToTermsMap = {};
    const termsToVarsMap = {};
    utils_1.termNames.forEach((termName) => {
        if (termName in stage.pattern) {
            const term = stage.pattern[termName];
            if (!term)
                return;
            if (term.charAt(0) === '?') {
                variables[term] = true;
                varsToTermsMap[term] = termName;
                termsToVarsMap[termName] = term;
            }
            else {
                pattern[termName] = term;
            }
        }
    });
    return { ...stage, variables, pattern, termsToVarsMap, varsToTermsMap };
};
const parseFilterSearchStage = (stage) => {
    const variables = {};
    stage.args.forEach((arg) => {
        if (arg.charAt(0) === '?') {
            variables[arg] = true;
        }
    });
    return { ...stage, variables };
};
const parseSearchStage = (stage) => {
    switch (stage.type) {
        case "bgp":
            return parseBgpSearchStage(stage);
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            return parseFilterSearchStage(stage);
        default:
            throw new Error(`Unsupported search stage type "${stage.type}"`);
    }
};
const applyBgpSearchStage = async (store, prevResult, nextStage) => {
    return await nestedLoopJoin(store, prevResult, nextStage);
};
const applyFilterSearchStage = async (store, prevResult, nextStage) => {
    const filterFn = filtering_1.compileFilter(nextStage);
    const iterator = prevResult.iterator.filter(filterFn);
    return { ...prevResult, iterator };
};
const applySearchStage = async (store, prevResult, nextStage) => {
    switch (nextStage.type) {
        case "bgp":
            if (prevResult.type !== "bindings") {
                throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
            }
            return await applyBgpSearchStage(store, prevResult, nextStage);
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            if (prevResult.type !== "bindings") {
                throw new Error(`Unsupported search stage of type "${nextStage.type}" after a stage that produces results of type "${prevResult.type}"`);
            }
            return await applyFilterSearchStage(store, prevResult, nextStage);
        default:
            throw new Error(`Unsupported search stage type "${nextStage.type}"`);
    }
};
exports.searchStream = async (store, stages) => {
    const parsedStages = stages.map(parseSearchStage);
    return await p_iteration_1.default.reduce(parsedStages.slice(1), applySearchStage.bind(null, store), await getBindingsIterator(store, parsedStages[0]));
};
//# sourceMappingURL=index.js.map