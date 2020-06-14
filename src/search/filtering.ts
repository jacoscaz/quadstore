import {TSBinding, TSParsedFilterSearchStage} from '../types';


const { filterType } = require('../utils/enums');

const compileGtFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => binding[stage.args[0]] > stage.args[1];
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => binding[stage.args[0]] > binding[stage.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileGteFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => binding[stage.args[0]] >= stage.args[1];
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => binding[stage.args[0]] >= binding[stage.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileLtFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => binding[stage.args[0]] < stage.args[1];
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => binding[stage.args[0]] < binding[stage.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileLteFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => binding[stage.args[0]] <= stage.args[1];
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => binding[stage.args[0]] <= binding[stage.args[1]];
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

export const compileFilter = (stage: TSParsedFilterSearchStage) => {
  switch (stage.type) {
    case filterType.GT:
      return compileGtFilter(stage);
    case filterType.GTE:
      return compileGteFilter(stage);
    case filterType.LT:
      return compileLtFilter(stage);
    case filterType.LTE:
      return compileLteFilter(stage);
    default:
      throw new Error(`Unsupported filter type "${stage.type}"`);
  }
};

export const getFilterTermRange = (stage: TSParsedFilterSearchStage) => {
  switch (stage.type) {
    case filterType.LT:
      return { lt: stage.args[1] };
    case filterType.LTE:
      return { lte: stage.args[1] };
    case filterType.GT:
      return { gt: stage.args[1] };
    case filterType.GTE:
      return { gte: stage.args[1] };
    default:
      return null;
  }
};

module.exports.getFilterTermRange = getFilterTermRange;
