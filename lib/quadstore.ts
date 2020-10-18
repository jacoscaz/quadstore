
'use strict';

import {
  consumeInBatches,
  consumeOneByOne, emptyObject,
  isAbstractLevelDOWNInstance,
  isDataFactory,
  isObject,
  nanoid,
  streamToArray,
  termNames,
  defaultIndexes,
} from './utils';
import assert from 'assert';
import {EventEmitter} from 'events';

import {importPattern, importQuad, importSimpleTerm, serializeImportedQuad} from './serialization';
import {AsyncIterator, TransformIterator} from 'asynciterator';
import {DataFactory, Quad, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Store, Stream, Term,} from 'rdf-js';
import {
  DefaultGraphMode,
  DelStreamOpts,
  EmptyOpts,
  GetOpts,
  InternalIndex,
  ImportedPattern,
  PutStreamOpts,
  Binding,
  BindingArrayResult,
  BindingStreamResult, BooleanResult,
  Pattern,
  QuadArrayResult,
  QuadStreamResult,
  StoreOpts,
  VoidResult,
  TSReadable,
  ResultType,
  SparqlOpts,
  TermName, Prefixes,
} from './types';
import {AbstractLevelDOWN} from 'abstract-leveldown';
import levelup from 'levelup';
import {getApproximateSize, getStream, compileCanBeUsedWithPatternFn, compileGetKeyFn} from './get';
import {Algebra} from 'sparqlalgebrajs';
import {newEngine, ActorInitSparql} from 'quadstore-comunica';
import {sparql, sparqlStream} from './sparql';


export class Quadstore extends EventEmitter implements Store {

  readonly db: AbstractLevelDOWN;
  readonly abstractLevelDOWN: AbstractLevelDOWN;

  readonly defaultGraph: string;
  readonly indexes: InternalIndex[];
  readonly id: string;

  readonly separator: string;
  readonly boundary: string;

  readonly engine: ActorInitSparql;
  readonly prefixes: Prefixes;

  readonly dataFactory: DataFactory;

  defaultGraphMode: DefaultGraphMode;

  constructor(opts: StoreOpts) {

    super();

    assert(isObject(opts), 'Invalid "opts" argument: "opts" is not an object');

    assert(isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
    assert(isAbstractLevelDOWNInstance(opts.backend), 'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN');

    this.dataFactory = opts.dataFactory;

    this.abstractLevelDOWN = opts.backend;
    this.db = levelup(this.abstractLevelDOWN);
    this.indexes = [];
    this.id = nanoid();
    this.boundary = opts.boundary || '\uDBFF\uDFFF';
    this.separator = opts.separator || '\u0000\u0000';

    (opts.indexes || defaultIndexes)
      .forEach((index: TermName[]) => this._addIndex(index));
    setImmediate(() => { this._initialize(); });

    this.engine = newEngine();

    this.prefixes = opts.prefixes || {
      expandTerm: term => term,
      compactIri: iri => iri,
    };

    this.defaultGraphMode = opts.defaultGraphMode || DefaultGraphMode.UNION;

    this.defaultGraph = importSimpleTerm(this.dataFactory.defaultGraph(), true, 'urn:rdfstore:dg', this.prefixes);

  }

  fork(opts: { defaultGraphMode?: DefaultGraphMode} = {}): Quadstore {
    const fork = <Quadstore>Object.create(this);
    if (opts.defaultGraphMode) fork.defaultGraphMode = opts.defaultGraphMode;
    return fork;
  }

  _initialize() {
    this.emit('ready');
  }

  async close() {
    await new Promise((resolve, reject) => {
      this.db.close((err) => {
        err ? reject(err) : resolve();
      });
    });
  }

  /*
   * ==========================================================================
   *                           STORE SERIALIZATION
   * ==========================================================================
   */

  toString() {
    return this.toJSON();
  }

  toJSON() {
    return `[object ${this.constructor.name}::${this.id}]`;
  }

  /*
   * ==========================================================================
   *                                  INDEXES
   * ==========================================================================
   */

  _addIndex(terms: TermName[]): void {
    const name = terms.map(t => t.charAt(0).toUpperCase()).join('');
    this.indexes.push({
      terms,
      name,
      getKey: compileGetKeyFn(name, this.separator, terms),
      canBeUsedWithPattern: compileCanBeUsedWithPatternFn(terms),
    });
  }

  // **************************************************************************
  // ******************************** RDF/JS **********************************
  // **************************************************************************


  match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph): Stream<Quad> {
    const iterator = new TransformIterator<Quad, Quad>();
    const pattern: Pattern = { subject, predicate, object, graph };
    this.getStream(pattern, {})
      .then((results) => {
        iterator.source = <AsyncIterator<Quad>>results.iterator;
      })
      .catch((err) => {
        // TODO: is the destroy() method really supported by AsyncIterator?
        // @ts-ignore
        iterator.emit('error', err);
        iterator.destroy();
      });
    return <Stream<Quad>>iterator;
  }

  /**
   * RDF/JS.Sink.import()
   * @param source
   * @param opts
   * @returns {*|EventEmitter}
   */
  import(source: Stream<Quad>): EventEmitter {
    const emitter = new EventEmitter();
    this.putStream(<TSReadable<Quad>>source, {})
      .then(() => { emitter.emit('end'); })
      .catch((err) => { emitter.emit('error', err); });
    return emitter;
  }

  remove(source: Stream<Quad>): EventEmitter {
    const emitter = new EventEmitter();
    this.delStream(<TSReadable<Quad>>source, {})
      .then(() => emitter.emit('end'))
      .catch((err) => emitter.emit('error', err));
    return emitter;
  }

  /**
   * RDF/JS.Store.removeMatches()
   * @param subject
   * @param predicate
   * @param object
   * @param graph
   * @returns {*}
   */
  removeMatches(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph) {
    const source = this.match(subject, predicate, object, graph);
    return this.remove(source);
  }

  /**
   * RDF/JS.Store.deleteGraph()
   * @param graph
   * @returns {*}
   */
  deleteGraph(graph: Quad_Graph) {
    return this.removeMatches(undefined, undefined, undefined, graph);
  }

  // **************************************************************************
  // ******************************* ARRAY API ********************************
  // **************************************************************************

  async getApproximateSize(pattern: Pattern, opts: EmptyOpts = emptyObject) {
    const importedTerms: ImportedPattern = importPattern(pattern, this.defaultGraph, this.prefixes);
    return await getApproximateSize(this, importedTerms, opts);
  }

  async sparql(query: Algebra.Operation|string, opts: SparqlOpts = emptyObject): Promise<QuadArrayResult|BindingArrayResult|VoidResult|BooleanResult> {
    return sparql(this, query, opts);
  }

  /*
   * ==========================================================================
   *                            NON-STREAMING API
   * ==========================================================================
   */

  async put(quad: Quad, opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    const importedQuad = importQuad(quad, this.defaultGraph, this.prefixes);
    const value = serializeImportedQuad(importedQuad);
    const batch = this.indexes.reduce((indexBatch, i) => {
      return indexBatch.put(i.getKey(importedQuad), value);
    }, this.db.batch());
    // @ts-ignore
    await batch.write();
    return { type: ResultType.VOID };
  }

  async multiPut(quads: Quad[], opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    const importedQuads = quads.map(quad => importQuad(quad, this.defaultGraph, this.prefixes));
    const batch = importedQuads.reduce((quadBatch, importedQuad) => {
      const value = serializeImportedQuad(importedQuad);
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.put(index.getKey(importedQuad), value);
      }, quadBatch);
    }, this.db.batch());
    // @ts-ignore
    await batch.write();
    return { type: ResultType.VOID };
  }

  async del(quad: Quad, opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    const importedQuad = importQuad(quad, this.defaultGraph, this.prefixes);
    const batch = this.indexes.reduce((batch, i) => {
      return batch.del(i.getKey(importedQuad));
    }, this.db.batch());
    // @ts-ignore
    await batch.write();
    return { type: ResultType.VOID };
  }

  async multiDel(quads: Quad[], opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    let importedQuads = quads.map(quad => importQuad(quad, this.defaultGraph, this.prefixes));
    const batch = importedQuads.reduce((quadBatch, importedQuad) => {
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.del(index.getKey(importedQuad));
      }, quadBatch);
    }, this.db.batch());
    // @ts-ignore
    await batch.write();
    return { type: ResultType.VOID };
  }

  async patch(oldQuad: Quad, newQuad: Quad, opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    const importedOldQuad = importQuad(oldQuad, this.defaultGraph, this.prefixes);
    const importedNewQuad = importQuad(newQuad, this.defaultGraph, this.prefixes);
    const value = serializeImportedQuad(importedNewQuad);
    const batch = this.indexes.reduce((indexBatch, i) => {
      return indexBatch.del(i.getKey(importedOldQuad)).put(i.getKey(importedNewQuad), value);
    }, this.db.batch());
    // @ts-ignore
    await batch.write();
    return { type: ResultType.VOID };
  }

  async multiPatch(oldQuads: Quad[], newQuads: Quad[], opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    const importedOldQuads = oldQuads.map(quad => importQuad(quad, this.defaultGraph, this.prefixes));
    const importedNewQuads = newQuads.map(quad => importQuad(quad, this.defaultGraph, this.prefixes));
    let batch = this.db.batch();
    batch = importedOldQuads.reduce((quadBatch, importedOldQuad) => {
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.del(index.getKey(importedOldQuad));
      }, quadBatch);
    }, batch);
    batch = importedNewQuads.reduce((quadBatch, importedNewQuad) => {
      const value = serializeImportedQuad(importedNewQuad);
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.put(index.getKey(importedNewQuad), value);
      }, quadBatch);
    }, batch);
    // @ts-ignore
    await batch.write();
    return { type: ResultType.VOID };
  }

  async get(pattern: Pattern, opts: GetOpts = emptyObject): Promise<QuadArrayResult> {
    const results = await this.getStream(pattern, opts);
    const items: Quad[] = await streamToArray(results.iterator);
    return { type: results.type, items };
  }


  // **************************************************************************
  // ******************************* STREAM API *******************************
  // **************************************************************************

  async getStream(pattern: Pattern, opts: EmptyOpts = emptyObject): Promise<QuadStreamResult> {
    const importedMatchTerms: ImportedPattern = importPattern(pattern, this.defaultGraph, this.prefixes);
    return await getStream(this, importedMatchTerms, opts);
  }

  async putStream(source: TSReadable<Quad>, opts: PutStreamOpts = emptyObject): Promise<VoidResult> {
    const batchSize = opts.batchSize || 1;
    if (batchSize === 1) {
      await consumeOneByOne<Quad>(source, quad => this.put(quad));
    } else {
      await consumeInBatches<Quad>(source, batchSize, quads => this.multiPut(quads));
    }
    return { type: ResultType.VOID };
  }

  async delStream(source: TSReadable<Quad>, opts: DelStreamOpts = emptyObject): Promise<VoidResult> {
    const batchSize = opts.batchSize || 1;
    if (batchSize === 1) {
      await consumeOneByOne<Quad>(source, quad => this.del(quad));
    } else {
      await consumeInBatches<Quad>(source, batchSize, quads => this.multiDel(quads));
    }
    return { type: ResultType.VOID };
  }

  async sparqlStream(query: Algebra.Operation|string, opts: SparqlOpts = emptyObject): Promise<QuadStreamResult|BindingStreamResult|VoidResult|BooleanResult> {
    return await sparqlStream(this, query, opts);
  }

  getTermComparator(): (a: Term, b: Term) => (-1 | 0 | 1) {
    return (a: Term, b: Term): -1|0|1 => {
      if (a.termType !== b.termType) {
        return a.termType < b.termType ? -1 : 1;
      }
      if (a.termType !== 'Literal' || b.termType !== 'Literal') {
        return a.value < b.value ? -1 : (a.value === b.value ? 0 : 1);
      }
      if (a.datatype !== b.datatype) {
        return a.datatype < b.datatype ? -1 : 1;
      }
      if (a.language !== b.language) {
        return a.language < b.language ? -1 : 1;
      }
      return a.value < b.value ? -1 : (a.value === b.value ? 0 : 1);
    };
  }

  getQuadComparator(_termNames: TermName[] = termNames): (a: Quad, b: Quad) => (-1 | 0 | 1) {
    const termComparator = this.getTermComparator();
    return (a: Quad, b: Quad) => {
      for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
        r = termComparator(a[_termNames[i]], b[_termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

  getBindingComparator(_termNames: string[]): (a: Binding, b: Binding) => -1|0|1 {
    const termComparator = this.getTermComparator();
    return (a: Binding, b: Binding) => {
      for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
        r = termComparator(a[_termNames[i]], b[_termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

}
