
import {BlankNode, Literal, NamedNode, Quad_Graph, Quad_Predicate, Quad_Subject, Variable} from 'rdf-js';
import {PropertyPath, Quads, Triple} from 'sparqljs';
import {TSRdfBinding, TSRdfQuad, TSRdfSimplePattern, TSRdfStore} from '../types';

const parseSubject = (subject: NamedNode | BlankNode | Variable | Literal): Quad_Subject => {
  if (subject.termType === 'Literal') {
    throw new Error('Literals not supported');
  }
  return subject;
}

const parsePredicate = (predicate: Literal | BlankNode | NamedNode | Variable | PropertyPath): Quad_Predicate => {
  if ('type' in predicate) {
    throw new Error('Property paths are not supported');
  }
  if (predicate.termType === 'Literal') {
    throw new Error('Literals not supported');
  }
  if (predicate.termType === 'BlankNode') {
    throw new Error('Blank nodes not supported');
  }
  return predicate;
};

export const graphTripleToQuad = (store: TSRdfStore, triple: Triple, graph: Quad_Graph): TSRdfQuad => {
  return store.dataFactory.quad(
    parseSubject(triple.subject),
    parsePredicate(triple.predicate),
    triple.object,
    graph,
  );
};

export const bgpTripleToQuad = (store: TSRdfStore, triple: Triple): TSRdfQuad => {
  return store.dataFactory.quad(
    parseSubject(triple.subject),
    parsePredicate(triple.predicate),
    triple.object,
    store.dataFactory.defaultGraph(),
  );
};

export const sparqlPatternToPatterns = (store: TSRdfStore, pattern: Quads): TSRdfSimplePattern[] => {
  const patterns: TSRdfSimplePattern[] = [];
  switch (pattern.type) {
    case 'bgp':
      patterns.push(...pattern.triples.map(triple => bgpTripleToQuad(store, triple)));
      break;
    case 'graph':
      patterns.push(...pattern.triples.map(triple => graphTripleToQuad(store, triple, pattern.name)));
      break;
    default:
      // @ts-ignore
      throw new Error(`Unsupported SPARQL pattern type "${pattern.type}`);
  }
  return patterns;
};
