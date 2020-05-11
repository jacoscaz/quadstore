
const _ = require('../utils/lodash');
const assert = require('assert');
const enums = require('../utils/enums');
const masking = require('./masking');

const compileGtFilter = (filter) => {
  if (filter.variableCount === 1) {
    return (binding) => binding[filter.args[0]] > filter.args[1];
  }
  if (filter.variableCount === 2) {
    return (binding) => binding[filter.args[0]] > binding[filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${filter.type}"`);
};

const compileGteFilter = (filter) => {
  if (filter.variableCount === 1) {
    return (binding) => binding[filter.args[0]] >= filter.args[1];
  }
  if (filter.variableCount === 2) {
    return (binding) => binding[filter.args[0]] >= binding[filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${filter.type}"`);
};

const compileLtFilter = (filter) => {
  if (filter.variableCount === 1) {
    return (binding) => binding[filter.args[0]] < filter.args[1];
  }
  if (filter.variableCount === 2) {
    return (binding) => binding[filter.args[0]] < binding[filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${filter.type}"`);
};

const compileLteFilter = (filter) => {
  if (filter.variableCount === 1) {
    return (binding) => binding[filter.args[0]] <= filter.args[1];
  }
  if (filter.variableCount === 2) {
    return (binding) => binding[filter.args[0]] <= binding[filter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${filter.type}"`);
};


const compileFilter = (filter) => {
  switch (filter.type) {
    case enums.filterType.GT:
      return compileGtFilter(filter);
    case enums.filterType.GTE:
      return compileGteFilter(filter);
    case enums.filterType.LT:
      return compileLtFilter(filter);
    case enums.filterType.LTE:
      return compileLteFilter(filter);
    default:
      return null;
  }
};

module.exports.compileFilter = compileFilter;

const getFilterTermRange = (filter) => {
  switch (filter.type) {
    case enums.filterType.LT:
      return { lt: filter.args[1] };
    case enums.filterType.LTE:
      return { lte: filter.args[1] };
    case enums.filterType.GT:
      return { gt: filter.args[1] };
    case enums.filterType.GTE:
      return { gte: filter.args[1] };
    default:
      return null;
  }
};

module.exports.getFilterTermRange = getFilterTermRange;

const parseFilter = (filter) => {
  const { args } = filter;
  assert(_.isArray(args) && args.length > 0, 'Invalid filter: missing of invalid arguments');
  assert(args[0].charAt(0) === '?', 'Invalid filter: first argument is not a variable');
  let variableCount = 1;
  let variableNames = [args[0]];
  for (const arg of args.slice(1)) {
    if (arg.charAt(0) === '?') {
      variableNames.push(arg);
      variableCount += 1;
    }
  }
  const variableMask = masking.getVariableMask(variableNames);
  return { ...filter, variableCount, variableNames, variableMask };
};

module.exports.parseFilter = parseFilter;

const parseFilters = (filters) => {
  const singleVarFiltersByVariableMask = {};
  const multiVarFiltersByVariableMask = {};
  for (const filter of filters) {
    const parsed = parseFilter(filter);
    const { variableCount, variableMask } = parsed;
    const container = variableCount === 1
      ? singleVarFiltersByVariableMask
      : multiVarFiltersByVariableMask;
    (container[variableMask] || (container[variableMask] = [])).push(parsed);
  }
  return { singleVarFiltersByVariableMask, multiVarFiltersByVariableMask };
}

module.exports.parseFilters = parseFilters;

