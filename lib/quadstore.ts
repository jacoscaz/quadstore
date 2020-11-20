
'use strict';

import {
  consumeInBatches,
  consumeOneByOne,
  emptyObject,
  isAbstractLevelDOWNInstance,
  isObject,
  nanoid,
  streamToArray,
  termNames,
  defaultIndexes,
  pFromCallback,
} from './utils';
import assert from 'assert';
import {EventEmitter} from 'events';
import {importPattern, importQuad, importSimpleTerm, serializeImportedQuad} from './serialization';
import {AsyncIterator, TransformIterator} from 'asynciterator';
import {DataFactory, Quad, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Store, Stream, Term} from 'rdf-js';
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
import {getApproximateSize, getStream, compileCanBeUsedWithPatternFn, compileGetKeyFn} from './get';
import {Algebra} from 'sparqlalgebrajs';
import {newEngine, ActorInitSparql} from 'quadstore-comunica';
import {sparql, sparqlStream} from './sparql';
import {DataFactory as RdfDataFactory} from 'rdf-data-factory';


export class Quadstore implements Store {

  readonly db: AbstractLevelDOWN;

  readonly defaultGraph: string;
  readonly indexes: InternalIndex[];
  readonly id: string;

  readonly separator: string;
  readonly boundary: string;

  readonly engine: ActorInitSparql;
  readonly prefixes: Prefixes;

  readonly dataFactory: DataFactory;

  sparqlMode: boolean;
  defaultGraphMode: DefaultGraphMode;

  constructor(opts: StoreOpts) {
    assert(isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(isAbstractLevelDOWNInstance(opts.backend), 'Invalid "opts" argument: "opts.backend" is not an instance of AbstractLevelDOWN');
    this.dataFactory = opts.dataFactory || new RdfDataFactory();
    this.db = opts.backend;
    this.indexes = [];
    this.id = nanoid();
    this.boundary = opts.boundary || '\uDBFF\uDFFF';
    this.separator = opts.separator || '\u0000\u0000';
    (opts.indexes || defaultIndexes)
      .forEach((index: TermName[]) => this._addIndex(index));
    this.engine = newEngine();
    this.prefixes = opts.prefixes || {
      expandTerm: term => term,
      compactIri: iri => iri,
    };
    this.sparqlMode = false;
    this.defaultGraphMode = opts.defaultGraphMode || DefaultGraphMode.UNION;
    this.defaultGraph = importSimpleTerm(this.dataFactory.defaultGraph(), true, 'urn:rdfstore:dg', this.prefixes);
  }

  fork(opts: { defaultGraphMode?: DefaultGraphMode, sparqlMode?: boolean } = {}): Quadstore {
    const fork = <Quadstore>Object.create(this);
    if (typeof opts.sparqlMode === 'boolean') {
      fork.sparqlMode = opts.sparqlMode;
    }
    if (opts.defaultGraphMode) {
      fork.defaultGraphMode = opts.defaultGraphMode;
    }
    return fork;
  }

  protected ensureReady() {
    if (this.db.status !== 'open') {
      throw new Error(`Store is not ready (status: "${this.db.status}"). Did you call store.open()?`);
    }
  }

  protected waitForStatus(status: string, timeout: number = 200) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        clearInterval(i);
        clearTimeout(t);
        reject(new Error(`Timeout while waiting for status "${status}"`));
      }, timeout);
      const i = setInterval(() => {
        if (this.db.status === status) {
          clearInterval(i);
          clearTimeout(t);
          resolve();
        }
      }, 10);
    });
  }

  async open() {
    switch (this.db.status) {
      case 'closing':
        await this.waitForStatus('closed');
      case 'new':
      case 'closed':
        await pFromCallback((cb) => { this.db.open(cb); });
        break;
      case 'opening':
        await this.waitForStatus('open');
        break;
      case 'open':
      default:
    }
  }

  async close() {
    switch (this.db.status) {
      case 'opening':
        await this.waitForStatus('open');
      case 'open':
      case 'new':
        await pFromCallback((cb) => { this.db.close(cb); });
        break;
      case 'closing':
        await this.waitForStatus('closed');
        break;
      case 'closed':
      default:
    }
  }

  toString() {
    return this.toJSON();
  }

  toJSON() {
    return `[object ${this.constructor.name}::${this.id}]`;
  }

  _addIndex(terms: TermName[]): void {
    const name = terms.map(t => t.charAt(0).toUpperCase()).join('');
    this.indexes.push({
      terms,
      name,
      getKey: compileGetKeyFn(name, this.separator, terms),
      canBeUsedWithPattern: compileCanBeUsedWithPatternFn(terms),
    });
  }

  match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph, opts: GetOpts = emptyObject): Stream<Quad> {
    const iterator = new TransformIterator<Quad, Quad>();
    const pattern: Pattern = { subject, predicate, object, graph };
    this.getStream(pattern, opts)
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

  async countQuads(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph, opts: GetOpts = emptyObject): Promise<number> {
    const pattern: Pattern = { subject, predicate, object, graph };
    const results = await this.getApproximateSize(pattern, opts);
    return results.approximateSize;
  }

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

  removeMatches(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph, opts: GetOpts = emptyObject) {
    const source = this.match(subject, predicate, object, graph, opts);
    return this.remove(source);
  }

  deleteGraph(graph: Quad_Graph) {
    return this.removeMatches(undefined, undefined, undefined, graph);
  }

  async getApproximateSize(pattern: Pattern, opts: GetOpts = emptyObject) {
    await this.ensureReady();
    const importedTerms: ImportedPattern = importPattern(pattern, this.defaultGraph, this.prefixes);
    return await getApproximateSize(this, importedTerms, opts);
  }

  async sparql(query: Algebra.Operation|string, opts: SparqlOpts = emptyObject): Promise<QuadArrayResult|BindingArrayResult|VoidResult|BooleanResult> {
    this.ensureReady();
    return sparql(this, query, opts);
  }

  async put(quad: Quad, opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const importedQuad = importQuad(quad, this.defaultGraph, this.prefixes);
    const value = serializeImportedQuad(importedQuad);
    const batch = this.indexes.reduce((indexBatch, i) => {
      return indexBatch.put(i.getKey(importedQuad), value);
    }, this.db.batch());
    await pFromCallback((cb) => { batch.write(cb); });
    return { type: ResultType.VOID };
  }

  async multiPut(quads: Quad[], opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batch = quads.reduce((quadBatch, quad) => {
      const importedQuad = importQuad(quad, this.defaultGraph, this.prefixes);
      const value = serializeImportedQuad(importedQuad);
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.put(index.getKey(importedQuad), value);
      }, quadBatch);
    }, this.db.batch());
    await pFromCallback((cb) => { batch.write(cb); });
    return { type: ResultType.VOID };
  }

  async del(quad: Quad, opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batch = this.indexes.reduce((batch, i) => {
      return batch.del(i.getKey(importQuad(quad, this.defaultGraph, this.prefixes)));
    }, this.db.batch());
    await pFromCallback((cb) => { batch.write(cb); });
    return { type: ResultType.VOID };
  }

  async multiDel(quads: Quad[], opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batch = quads.reduce((quadBatch, quad) => {
      const importedQuad = importQuad(quad, this.defaultGraph, this.prefixes);
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.del(index.getKey(importedQuad));
      }, quadBatch);
    }, this.db.batch());

    await pFromCallback((cb) => { batch.write(cb); });
    return { type: ResultType.VOID };
  }

  async patch(oldQuad: Quad, newQuad: Quad, opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const importedNewQuad = importQuad(newQuad, this.defaultGraph, this.prefixes);
    const value = serializeImportedQuad(importedNewQuad);
    const batch = this.indexes.reduce((indexBatch, i) => {
      return indexBatch.del(i.getKey(importQuad(oldQuad, this.defaultGraph, this.prefixes)))
        .put(i.getKey(importedNewQuad), value);
    }, this.db.batch());
    await pFromCallback((cb) => { batch.write(cb); });
    return { type: ResultType.VOID };
  }

  async multiPatch(oldQuads: Quad[], newQuads: Quad[], opts: EmptyOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    let batch = this.db.batch();
    batch = oldQuads.reduce((quadBatch, oldQuad) => {
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.del(index.getKey(importQuad(oldQuad, this.defaultGraph, this.prefixes)));
      }, quadBatch);
    }, batch);
    batch = newQuads.reduce((quadBatch, newQuad) => {
      const importedNewQuad = importQuad(newQuad, this.defaultGraph, this.prefixes)
      const value = serializeImportedQuad(importedNewQuad);
      return this.indexes.reduce((indexBatch, index) => {
        return indexBatch.put(index.getKey(importedNewQuad), value);
      }, quadBatch);
    }, batch);
    await pFromCallback((cb) => { batch.write(cb); });
    return { type: ResultType.VOID };
  }

  async get(pattern: Pattern, opts: GetOpts = emptyObject): Promise<QuadArrayResult> {
    this.ensureReady();
    const results = await this.getStream(pattern, opts);
    const items: Quad[] = await streamToArray(results.iterator);
    return { type: results.type, items };
  }

  async getStream(pattern: Pattern, opts: GetOpts = emptyObject): Promise<QuadStreamResult> {
    this.ensureReady();
    return await getStream(this, importPattern(pattern, this.defaultGraph, this.prefixes), opts);
  }

  async putStream(source: TSReadable<Quad>, opts: PutStreamOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batchSize = opts.batchSize || 1;
    if (batchSize === 1) {
      await consumeOneByOne<Quad>(source, quad => this.put(quad));
    } else {
      await consumeInBatches<Quad>(source, batchSize, quads => this.multiPut(quads));
    }
    return { type: ResultType.VOID };
  }

  async delStream(source: TSReadable<Quad>, opts: DelStreamOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batchSize = opts.batchSize || 1;
    if (batchSize === 1) {
      await consumeOneByOne<Quad>(source, quad => this.del(quad));
    } else {
      await consumeInBatches<Quad>(source, batchSize, quads => this.multiDel(quads));
    }
    return { type: ResultType.VOID };
  }

  async sparqlStream(query: Algebra.Operation|string, opts: SparqlOpts = emptyObject): Promise<QuadStreamResult|BindingStreamResult|VoidResult|BooleanResult> {
    this.ensureReady();
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
