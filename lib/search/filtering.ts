
import {TSBinding, TSParsedFilterSearchStage, TSSearchStageType} from '../types/index.js';

const compileGtFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] > stage.args[1];
    }
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] > binding[stage.args[1]];
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileGteFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] >= stage.args[1];
    }
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] >= binding[stage.args[1]];
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileLtFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] < stage.args[1];
    }
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] < binding[stage.args[1]];
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileLteFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] <= stage.args[1] + '\uDBFF\uDFFF';
    }
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] <= binding[stage.args[1]];
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileEqFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] === stage.args[1];
    }
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] === binding[stage.args[1]];
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
}

const compileNeqFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] !== stage.args[1];
    }
  }
  if (variableCount === 2) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]] !== binding[stage.args[1]];
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
}

const compileStartsWithFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => {
      return binding[stage.args[0]].indexOf(stage.args[1]) === 0;
    }
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

const compileStartsWithoutFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  const variableCount = Object.keys(stage.variables).length;
  if (variableCount === 1) {
    return (binding: TSBinding) => binding[stage.args[0]].indexOf(stage.args[1]) !== 0;
  }
  throw new Error(`Invalid number of arguments for filter type "${stage.type}"`);
};

export const compileFilter = (stage: TSParsedFilterSearchStage): (binding: TSBinding) => boolean => {
  switch (stage.type) {
    case TSSearchStageType.GT:
      return compileGtFilter(stage);
    case TSSearchStageType.GTE:
      return compileGteFilter(stage);
    case TSSearchStageType.LT:
      return compileLtFilter(stage);
    case TSSearchStageType.LTE:
      return compileLteFilter(stage);
    case TSSearchStageType.EQ:
      return compileEqFilter(stage);
    case TSSearchStageType.NEQ:
      return compileNeqFilter(stage);
    case TSSearchStageType.STARTS_WITH:
      return compileStartsWithFilter(stage);
    case TSSearchStageType.STARTS_WITHOUT:
      return compileStartsWithoutFilter(stage);
  }
};
