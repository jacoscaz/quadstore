// import {Quadstore} from '../quadstore';
// import {Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Term, Quad, Stream} from 'rdf-js';
// import {GetOpts, Pattern, QuadStreamResult, Range, ResultType} from '../types';
// import {
//   ExpressionFactory,
//   OperatorExpression,
//   MatchExpressionOpts,
//   Result,
//   Operator,
//   Expression,
//   TermExpression,
//   Metadata,
//   MetadataOpts
// } from './types';
// import {LevelIterator} from '../get/leveliterator';
// import {quadReader} from '../serialization';
// import {AsyncIterator} from 'asynciterator';
//
//
// const expressionFactory: ExpressionFactory = {
//   operatorExpression(operator: Operator, args: Expression[]): OperatorExpression {
//     return { expressionType: 'operator', operator, args };
//   },
//   termExpression(term: Term): TermExpression {
//     return {expressionType: 'term', term };
//   },
// };
//
//
// const rangesByVar: Record<string, Range> = {};
//
//
// class MatchExpressionResult implements Result {
//
//   store: Quadstore;
//   subject: Quad_Subject|undefined;
//   predicate: Quad_Predicate|undefined;
//   object: Quad_Object|undefined;
//   graph: Quad_Graph|undefined;
//   expression: OperatorExpression;
//
//   constructor(
//     store: Quadstore,
//     subject: Quad_Subject|undefined,
//     predicate: Quad_Predicate|undefined,
//     object: Quad_Object|undefined,
//     graph: Quad_Graph|undefined,
//     expression: OperatorExpression,
//   ) {
//     this.store = store;
//     this.subject = subject;
//     this.predicate = predicate;
//     this.object = object;
//     this.graph = graph;
//     this.expression = expression;
//   }
//
//   private scanTermExpression() {
//
//   }
//
//   private scanOperatorExpression() {
//
//   }
//
//   private scanExpression() {
//     switch (this.expression.expressionType) {
//       case 'operator':
//         this.scanTermExpression();
//         break;
//       case 'term':
//         this.scanOperatorExpression()
//         break;
//       default:
//     }
//   }
//
//   isSupported(): Promise<boolean> {
//     return Promise.resolve(false);
//   }
//
//   metadata(opts: MetadataOpts): Promise<Metadata> {
//     return Promise.resolve(undefined);
//   }
//
//   quads(): Promise<Stream<Quad>> {
//     return Promise.resolve(undefined);
//   }
//
//
//
// }
//
//
// export const matchExpression = async (
//   store: Quadstore,
//   subject: Quad_Subject|undefined,
//   predicate: Quad_Predicate|undefined,
//   object: Quad_Object|undefined,
//   graph: Quad_Graph|undefined,
//   expression: OperatorExpression,
//   opts?: MatchExpressionOpts,
// ): Promise<Result> => {
//
//   return new MatchExpressionResult(store, subject, predicate, object, graph, expression);
//
// };
