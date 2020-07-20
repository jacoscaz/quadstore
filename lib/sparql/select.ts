
import {
  TSEmptyOpts, TSFilterSearchStage,
  TSFilterSearchStageType,
  TSRdfBindingStreamResult, TSRdfFilterSearchStage,
  TSRdfSearchStage, TSRdfSimplePattern,
  TSRdfStore,
  TSSearchStageType
} from '../types/index.js';
import {Term, Quad_Graph} from 'rdf-js';
import {BgpPattern, FilterPattern, GraphPattern, Pattern, SelectQuery} from 'sparqljs';

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
    case '<':// @ts-ignore
      return { type: TSSearchStageType.LT, args: whereGroup.expression.args };
    case '<=':// @ts-ignore
      return { type: TSSearchStageType.LTE, args: whereGroup.expression.args };
    case '>':// @ts-ignore
      return { type: TSSearchStageType.GT, args: whereGroup.expression.args };
    case '>=':// @ts-ignore
      return { type: TSSearchStageType.GTE, args: whereGroup.expression.args };
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

export const handleSparqlSelect = async (store: TSRdfStore, parsed: { where?: Pattern[] }, opts: TSEmptyOpts): Promise<TSRdfBindingStreamResult> => {
  const stages: TSRdfSearchStage[] = []; // TODO: pipeline
  if (parsed.where) {
    parsed.where.forEach((pattern) => {
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
  }
  const results = <TSRdfBindingStreamResult>(await store.searchStream(stages, opts));
  return results;
};
