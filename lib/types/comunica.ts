
import type * as RDF from 'rdf-js';
import { Algebra } from 'sparqlalgebrajs';
import { AsyncIterator } from 'asynciterator';

/*
 * These typings represent the minimum subset of Comunica needed by quadstore
 * to run SPARQL queries. They are a subset of Comunica's full typings and have
 * been embedded into quadstore so that the latter does not have to depend on
 * the entire Comunica framework.
 */

interface ComunicaMap<K extends string, V> {
  get(key: K): V;
  toObject(): Record<K, V>;
}

type ComunicaBindings = ComunicaMap<string, RDF.Term>;

type ComunicaBindingsStream = AsyncIterator<ComunicaBindings>;

interface ComunicaActorQueryOperationOutputBase {
  type: string;
  metadata?: () => Promise<Record<string, any>>;
}

interface ComunicaQueryResultBindings extends ComunicaActorQueryOperationOutputBase {
  type: 'bindings';
  bindingsStream: ComunicaBindingsStream;
  variables: string[];
  canContainUndefs: boolean;
  bindings: () => Promise<ComunicaBindings[]>;
}

interface ComunicaQueryResultQuads extends ComunicaActorQueryOperationOutputBase {
  type: 'quads';
  quadStream: RDF.Stream & AsyncIterator<RDF.Quad>;
  quads: () => Promise<RDF.Quad[]>;
}

interface ComunicaQueryResultBoolean extends ComunicaActorQueryOperationOutputBase {
  type: 'boolean';
  booleanResult: Promise<boolean>;
}

type ComunicaQueryResult = ComunicaQueryResultBindings | ComunicaQueryResultQuads | ComunicaQueryResultBoolean;

export interface ComunicaActorInitSparql {
  query(query: string | Algebra.Operation, context?: any): Promise<ComunicaQueryResult>;
}
