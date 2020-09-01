import {
  TSBgpSearchStage,
  TSConstructSearchStage,
  TSFilterSearchStage,
  TSParsedBgpSearchStage,
  TSParsedConstructSearchStage,
  TSParsedFilterSearchStage,
  TSParsedSearchStage,
  TSSearchStage,
  TSSearchStageType,
  TSSimplePattern,
  TSTermName,
  TSTermsToVarsMap,
  TSVariables,
  TSVarsToTermsMap
} from '../types';
import {termNames} from '../utils';

const parseBgpSearchStage = (stage: TSBgpSearchStage): TSParsedBgpSearchStage => {
  const variables: TSVariables = {};
  const pattern: TSSimplePattern = {};
  const varsToTermsMap: TSVarsToTermsMap = {};
  const termsToVarsMap: TSTermsToVarsMap = {};
  termNames.forEach((termName: TSTermName) => {
    if (termName in stage.pattern) {
      const term = stage.pattern[termName];
      if (!term) return;
      if (term.charAt(0) === '?') {
        variables[term] = true;
        varsToTermsMap[term] = termName;
        termsToVarsMap[termName] = term;
      } else {
        pattern[termName] = term;
      }
    }
  });
  return { ...stage, variables, pattern, parsedPattern: pattern, termsToVarsMap, varsToTermsMap };
}

const parseFilterSearchStage = (stage: TSFilterSearchStage): TSParsedFilterSearchStage => {
  const variables: { [key: string]: true } = {};
  stage.args.forEach((arg, index: number) => {
    if (arg.charAt(0) === '?') {
      variables[arg] = true;
    } else {
      if (index === 0) {
        throw new Error(`The first argument of a search filter must always be a variable`);
      }
    }
  });
  return { ...stage, variables };
}

const parseMaterializeSearchStage = (stage: TSConstructSearchStage): TSParsedConstructSearchStage => {
  return stage;
};

export const parseSearchStage = (stage: TSSearchStage): TSParsedSearchStage => {
  switch (stage.type) {
    case TSSearchStageType.BGP:
      return parseBgpSearchStage(stage);
    case TSSearchStageType.LT:
    case TSSearchStageType.LTE:
    case TSSearchStageType.GT:
    case TSSearchStageType.GTE:
    case TSSearchStageType.EQ:
    case TSSearchStageType.NEQ:
    case TSSearchStageType.STARTS_WITH:
    case TSSearchStageType.STARTS_WITHOUT:
      return parseFilterSearchStage(stage);
    case TSSearchStageType.CONSTRUCT:
      return parseMaterializeSearchStage(stage);
    case TSSearchStageType.PROJECT:
      return <TSParsedSearchStage>stage;
    default:
      // @ts-ignore
      throw new Error(`Unsupported search stage type "${stage.type}"`);
  }
}
