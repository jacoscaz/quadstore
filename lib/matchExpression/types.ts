import {Quad, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Stream, Term} from 'rdf-js';

export type Operator = string; // '>'|'<'|'<='|'>=';

export interface Expression {
  expressionType: 'operator'|'term';
}

export interface OperatorExpression extends Expression {
  expressionType: 'operator';
  operator: Operator;
  args: Expression[];
}

export interface TermExpression extends Expression {
  expressionType: 'term';
  term: Term;
}

export interface MetadataOpts {
  count?: 'estimate'|'exact';
}

export interface Metadata {
  count: {
    type: 'estimate'|'exact';
    value: number;
  }
}

export interface Result {
  quads(): Promise<Stream<Quad>>;
  metadata(opts: MetadataOpts): Promise<Metadata>;
  isSupported(): Promise<boolean>;
}

export interface ExpressionFactory {
  operatorExpression(operator: Operator, args: Expression[]): OperatorExpression;
  termExpression(term: Term): TermExpression;
}

export type MatchExpressionOpts = {};

export interface ExpressionSource {
  matchExpession(subject: Quad_Subject, predicate: Quad_Predicate, object: Quad_Object, graph: Quad_Graph, expression: OperatorExpression): Promise<Result>;
}
