import {
  TSDefaultGraphMode,
  TSRdfBindingStreamResult,
  TSRdfFilterSearchStage,
  TSRdfQuadStreamResult,
  TSRdfSearchStage,
  TSRdfSimplePattern,
  TSRdfStore, TSSearchOpts,
  TSSearchStageType,
} from '../types/index.js';
import {Term} from 'rdf-js';
import {
  BgpPattern,
  FilterPattern,
  GraphPattern,
  Pattern,
  SelectQuery,
  Variable,
  VariableExpression,
  Wildcard
} from 'sparqljs';

const parseSparqlFilter = (whereGroup: FilterPattern): TSRdfFilterSearchStage => {
  if (whereGroup.type !== 'filter') {
    throw new Error(`Not a filter`);
  }
  if (!('type' in whereGroup.expression)) {
    throw new Error(`Unsupported where expression`);
  }
  if (whereGroup.expression.type !== 'operation') {
    throw new Error(`Unsupported filter expression type "${whereGroup.expression.type}"`);
  }
  switch (whereGroup.expression.operator) {
    case '<':
      // TODO: fix this ts-ignore
      // @ts-ignore
      return { type: TSSearchStageType.LT, args: whereGroup.expression.args };
    case '<=':
      // TODO: fix this ts-ignore
      // @ts-ignore
      return { type: TSSearchStageType.LTE, args: whereGroup.expression.args };
    case '>':
      // TODO: fix this ts-ignore
      // @ts-ignore
      return { type: TSSearchStageType.GT, args: whereGroup.expression.args };
    case '>=':
      // TODO: fix this ts-ignore
      // @ts-ignore
      return { type: TSSearchStageType.GTE, args: whereGroup.expression.args };
    case '=':
      // TODO: fix this ts-ignore
      // @ts-ignore
      return { type: TSSearchStageType.EQ, args: whereGroup.expression.args };
    case '!=':
      // TODO: fix this ts-ignore
      // @ts-ignore
      return { type: TSSearchStageType.EQ, args: whereGroup.expression.args };
    default:
      throw new Error(`Unsupported filter operator "${whereGroup.expression.operator}"`);
  }
}

const sparqlBgpPatternToStages = (pattern: BgpPattern, graph?: Term): TSRdfSearchStage[] => {
  return pattern.triples.map(triple => ({
    type: TSSearchStageType.BGP,
    pattern: <TSRdfSimplePattern><unknown>{...triple, graph},
    optional: false,
  }));
}

export interface TSHandleSparqlSelectOpts {
  defaultGraphMode?: TSDefaultGraphMode,
}

export const sparqlWherePatternArrayToStages = (group: Pattern[]) => {
  const stages: TSRdfSearchStage[] = [];
  group.forEach((pattern) => {
    switch (pattern.type) {
      case 'graph':
        const graphPattern = <GraphPattern>pattern;
        pattern.patterns.forEach((innerPattern) => {
          switch (innerPattern.type) {
            case 'bgp':
              stages.push(...sparqlBgpPatternToStages(innerPattern, graphPattern.name));
              break;
            default:
              throw new Error(`Unsupported WHERE group pattern type "${innerPattern.type}"`);
          }
        });
        break;
      case 'bgp':
        stages.push(...sparqlBgpPatternToStages(pattern));
        break;
      case 'filter':
        stages.push(parseSparqlFilter(pattern));
        break;
      default:
        throw new Error(`Unsupported WHERE group type "${pattern.type}"`);
    }
  });
  return stages;
};

export const handleSparqlSelect = async (store: TSRdfStore, parsed: SelectQuery, opts?: TSHandleSparqlSelectOpts): Promise<TSRdfBindingStreamResult|TSRdfQuadStreamResult> => {
  if (!parsed.where) {
    // TODO: is the "WHERE" block mandatory for SELECT queries?
    throw new Error('missing WHERE pattern group');
  }
  const stages: TSRdfSearchStage[] = sparqlWherePatternArrayToStages(parsed.where);
  if (!parsed.variables) {
    throw new Error('missing projection in SELECT query');
  }
  stages.push({
    type: TSSearchStageType.PROJECT,
    // @ts-ignore
    variables: parsed.variables.map((variable: Variable | Wildcard) => {
      if ('termType' in variable) {
        switch (variable.termType) {
          case 'Wildcard':
            return '*';
          case 'Variable':
            return `?${variable.value}`;
          default:
            throw new Error('Unsupported');
        }
      }
      return `?${variable.variable.value}`;
    }),
  });
  const searchOpts: TSSearchOpts = opts ? { ...opts } : {};
  if (parsed.limit) {
    searchOpts.limit = parsed.limit;
  }
  if (parsed.offset) {
    searchOpts.offset = parsed.offset;
  }
  if ('distinct' in parsed) throw new Error(`unsupported DISTINCT operator`);
  if ('having' in parsed) throw new Error(`unsupported HAVING operator`);
  if ('order' in parsed) throw new Error(`unsupported ORDER operator`);
  if ('group' in parsed) throw new Error(`unsupported GROUP operator`);
  if ('from' in parsed) throw new Error(`unsupported FROM operator`);
  const results = <TSRdfBindingStreamResult>(await store.searchStream(stages, searchOpts));
  return results;
};
