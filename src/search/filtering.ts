import {IBaseBinding, TParsedFilter} from '../types';

const { filterType } = require('../utils/enums');

const compileGtFilter = (parsedFilter: TParsedFilter): (binding: IBaseBinding) => boolean => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] > parsedFilter.args[1];
  }
  if (variableCount === 2) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] > binding[parsedFilter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};

const compileGteFilter = (parsedFilter: TParsedFilter): (binding: IBaseBinding) => boolean => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] >= parsedFilter.args[1];
  }
  if (variableCount === 2) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] >= binding[parsedFilter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};

const compileLtFilter = (parsedFilter: TParsedFilter): (binding: IBaseBinding) => boolean => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] < parsedFilter.args[1];
  }
  if (variableCount === 2) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] < binding[parsedFilter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};

const compileLteFilter = (parsedFilter: TParsedFilter): (binding: IBaseBinding) => boolean => {
  const variableCount = Object.keys(parsedFilter.variables).length;
  if (variableCount === 1) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] <= parsedFilter.args[1];
  }
  if (variableCount === 2) {
    return (binding: IBaseBinding) => binding[parsedFilter.args[0]] <= binding[parsedFilter.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${parsedFilter.type}"`);
};

const compileFilter = (parsedFilter: TParsedFilter) => {
  switch (parsedFilter.type) {
    case filterType.GT:
      return compileGtFilter(parsedFilter);
    case filterType.GTE:
      return compileGteFilter(parsedFilter);
    case filterType.LT:
      return compileLtFilter(parsedFilter);
    case filterType.LTE:
      return compileLteFilter(parsedFilter);
    default:
      throw new Error(`Unsupported filter type "${parsedFilter.type}"`);
  }
};

module.exports.compileFilter = compileFilter;

const getFilterTermRange = (parsedFilter: TParsedFilter) => {
  switch (parsedFilter.type) {
    case filterType.LT:
      return { lt: parsedFilter.args[1] };
    case filterType.LTE:
      return { lte: parsedFilter.args[1] };
    case filterType.GT:
      return { gt: parsedFilter.args[1] };
    case filterType.GTE:
      return { gte: parsedFilter.args[1] };
    default:
      return null;
  }
};

module.exports.getFilterTermRange = getFilterTermRange;
