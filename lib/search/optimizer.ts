
import {TSParsedFilterSearchStage, TSParsedSearchStage, TSPattern, TSRange, TSSearchStageType} from '../types';
import {QuadStore} from '../quadstore';
import {termNames} from '../utils/index.js';

const mergeRanges = (a: TSRange, b: TSRange): TSRange => {
  const c = {...b};
  if (a.lt !== undefined) {
    if (c.lt !== undefined) {
      if (a.lt < c.lt) {
        c.lt = a.lt;
      }
    } else {
      c.lt = a.lt;
    }
  }
  if (a.lte !== undefined) {
    if (c.lte !== undefined) {
      if (a.lte < c.lte) {
        c.lte = a.lte;
      }
    } else {
      c.lte = a.lte;
    }
  }
  if (a.gt !== undefined) {
    if (c.gt !== undefined) {
      if (a.gt > c.gt) {
        c.gt = a.gt;
      }
    } else {
      c.gt = a.gt;
    }
  }
  if (a.gte !== undefined) {
    if (c.gte !== undefined) {
      if (a.gte > c.gte) {
        c.gte = a.gte;
      }
    } else {
      c.gte = a.gte;
    }
  }
  return c;
};

const mergeValuesOrRanges = (a: TSRange|string, b: TSRange|string): TSRange => {
  if (typeof a === 'string') {
    if (typeof b === 'string') {
      return mergeRanges({ gte: a, lte: a }, { gte: b, lte: b });
    } else {
      return mergeRanges({ gte: a, lte: a }, b);
    }
  } else {
    if (typeof b === 'string') {
      return mergeRanges(a, { gte: b, lte: b });
    } else {
      return mergeRanges(a, b);
    }
  }
};

const mergePatterns = (a: TSPattern, b: TSPattern): TSPattern => {
  const c: TSPattern = { ...b };
  termNames.forEach((termName) => {
    if (a[termName] !== undefined) {
      if (c[termName] === undefined) {
        c[termName] = a[termName];
      } else {
        // @ts-ignore
        c[termName] = mergeValuesOrRanges(a[termName], c[termName]);
      }
    }
  });
  return c;
};

const applyRangeToBgpStages = (stages: TSParsedSearchStage[], variable: string, range: TSRange): TSParsedSearchStage[] => {
  return stages.map((stage: TSParsedSearchStage) => {
    if (stage.type !== TSSearchStageType.BGP) {
      return stage;
    }
    if (!stage.variables[variable]) {
      return stage;
    }
    return {
      ...stage,
      parsedPattern: mergePatterns(
        stage.parsedPattern,
        { [stage.varsToTermsMap[variable]]: range },
      ),
    }
  });
};

const optimizeEQFilter = (stages: TSParsedSearchStage[], stage: TSParsedFilterSearchStage): TSParsedSearchStage[] => {
  return applyRangeToBgpStages(stages, stage.args[0], { gte: stage.args[1], lte: stage.args[1] });
};

const optimizeGTFilter = (stages: TSParsedSearchStage[], stage: TSParsedFilterSearchStage): TSParsedSearchStage[] => {
  return applyRangeToBgpStages(stages, stage.args[0], { gt: stage.args[1] });
};

const optimizeGTEFilter = (stages: TSParsedSearchStage[], stage: TSParsedFilterSearchStage): TSParsedSearchStage[] => {
  return applyRangeToBgpStages(stages, stage.args[0], { gte: stage.args[1] });
};

const optimizeLTFilter = (stages: TSParsedSearchStage[], stage: TSParsedFilterSearchStage): TSParsedSearchStage[] => {
  return applyRangeToBgpStages(stages, stage.args[0], { lt: stage.args[1] });
};

const optimizeLTEFilter = (stages: TSParsedSearchStage[], stage: TSParsedFilterSearchStage): TSParsedSearchStage[] => {
  return applyRangeToBgpStages(stages, stage.args[0], { lte: stage.args[1] });
};

const optimizeSTARTSWITHFilter = (stages: TSParsedSearchStage[], stage: TSParsedFilterSearchStage): TSParsedSearchStage[] => {
  return applyRangeToBgpStages(stages, stage.args[0], { gte: stage.args[1], lte: stage.args[1] });
};

const optimizeFilters = async (store: QuadStore, stages: TSParsedSearchStage[]): Promise<TSParsedSearchStage[]> => {
  let optimizedStages: TSParsedSearchStage[] = stages;
  stages.forEach((stage: TSParsedSearchStage) => {
    // cannot optimize filters with more than one variable
    if ('args' in stage && Object.keys(stage.variables).length > 1) {
      return;
    }
    switch (stage.type) {
      case TSSearchStageType.EQ:
        optimizedStages = optimizeEQFilter(optimizedStages, stage);
        break;
      case TSSearchStageType.GT:
        optimizedStages = optimizeGTFilter(optimizedStages, stage);
        break;
      case TSSearchStageType.GTE:
        optimizedStages = optimizeGTEFilter(optimizedStages, stage);
        break;
      case TSSearchStageType.LT:
        optimizedStages = optimizeLTFilter(optimizedStages, stage);
        break;
      case TSSearchStageType.LTE:
        optimizedStages = optimizeLTEFilter(optimizedStages, stage);
        break;
      case TSSearchStageType.STARTS_WITH:
        optimizedStages = optimizeSTARTSWITHFilter(optimizedStages, stage);
        break;
    }
  });
  return optimizedStages;
};

export const optimize = async (store: QuadStore, stages: TSParsedSearchStage[]): Promise<TSParsedSearchStage[]> => {
  let optimized: TSParsedSearchStage[] = stages;
  optimized = await optimizeFilters(store, stages);
  return optimized;
};
