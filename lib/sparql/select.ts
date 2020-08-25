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
import {Term, Variable as RdfjsVariable, Literal as RdfjsLiteral, NamedNode as RdfjsNamedNode} from 'rdf-js';
import {
  BgpPattern, Expression,
  FilterPattern,
  GraphPattern, OperationExpression,
  Pattern,
  SelectQuery,
  Variable,
  VariableExpression,
  Wildcard,
} from 'sparqljs';

const parseSparqlFilterLiteralArgs = (args: Expression[]): (RdfjsVariable|RdfjsLiteral)[] => {
  args.forEach((arg: Expression) => {
    if (!('termType' in arg)) {
      throw new Error(`Unsupported argument type in SPARQL expression`);
    }
    switch (arg.termType) {
      case 'Variable':
      case 'Literal':
        break;
      default:
        throw new Error(`Unsupported term type "${arg.termType}" in SPARQL expression`);
    }
  });
  return <(RdfjsVariable|RdfjsLiteral)[]>args;
};

const parseSparqlFilterMixedTermTypeArgs = (args: Expression[]): (RdfjsVariable|RdfjsLiteral|RdfjsNamedNode)[] => {
  args.forEach((arg: Expression) => {
    if (!('termType' in arg)) {
      throw new Error(`Unsupported argument type in SPARQL expression`);
    }
    switch (arg.termType) {
      case 'Variable':
      case 'Literal':
      case 'NamedNode':
        break;
      default:
        throw new Error(`Unsupported term type "${arg.termType}" in SPARQL expression`);
    }
  });
  return <(RdfjsVariable|RdfjsLiteral|RdfjsNamedNode)[]>args;
};

const parseSparqlLtFilter = (op: OperationExpression): TSRdfFilterSearchStage => {
  const args = parseSparqlFilterLiteralArgs(op.args);
  if (args.length !== 2) {
    throw new Error(`Wrong number of arguments for "<" SPARQL filter (needs 2)`);
  }
  if (args[0].termType !== 'Variable' && args[1].termType === 'Variable') {
    return { type: TSSearchStageType.GT, args: args.reverse() };
  }
  return { type: TSSearchStageType.LT, args };
};

const parseSparqlLteFilter = (op: OperationExpression): TSRdfFilterSearchStage => {
  const args = parseSparqlFilterLiteralArgs(op.args);
  if (args.length !== 2) {
    throw new Error(`Wrong number of arguments for "<=" SPARQL filter (needs 2)`);
  }
  if (args[0].termType !== 'Variable' && args[1].termType === 'Variable') {
    return { type: TSSearchStageType.GTE, args: args.reverse() };
  }
  return { type: TSSearchStageType.LTE, args };
};

const parseSparqlGtFilter = (op: OperationExpression): TSRdfFilterSearchStage => {
  const args = parseSparqlFilterLiteralArgs(op.args);
  if (args.length !== 2) {
    throw new Error(`Wrong number of arguments for ">" SPARQL filter (needs 2)`);
  }
  if (args[0].termType !== 'Variable' && args[1].termType === 'Variable') {
    return { type: TSSearchStageType.LT, args: args.reverse() };
  }
  return { type: TSSearchStageType.GT, args };
};

const parseSparqlGteFilter = (op: OperationExpression): TSRdfFilterSearchStage => {
  const args = parseSparqlFilterLiteralArgs(op.args);
  if (args.length !== 2) {
    throw new Error(`Wrong number of arguments for ">=" SPARQL filter (needs 2)`);
  }
  if (args[0].termType !== 'Variable' && args[1].termType === 'Variable') {
    return { type: TSSearchStageType.LTE, args: args.reverse() };
  }
  return { type: TSSearchStageType.GTE, args };
};

const parseSparqlFilter = (whereGroup: FilterPattern): TSRdfFilterSearchStage => {
  if (!('type' in whereGroup.expression)) {
    throw new Error(`Unsupported WHERE expression`);
  }
  if (whereGroup.expression.type !== 'operation') {
    throw new Error(`Unsupported WHERE expression type "${whereGroup.expression.type}"`);
  }
  switch (whereGroup.expression.operator) {
    case '<':
      return parseSparqlLtFilter(whereGroup.expression);
    case '<=':
    case '=<':
      return parseSparqlLteFilter(whereGroup.expression);
    case '>':
      return parseSparqlGtFilter(whereGroup.expression);
    case '>=':
    case '=>':
      return parseSparqlGteFilter(whereGroup.expression);
    case '=':
      return { type: TSSearchStageType.EQ, args: parseSparqlFilterMixedTermTypeArgs(whereGroup.expression.args) };
    case '!=':
      return { type: TSSearchStageType.NEQ, args: parseSparqlFilterMixedTermTypeArgs(whereGroup.expression.args) };
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
