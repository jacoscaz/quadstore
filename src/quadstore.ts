
'use strict';

import type {
  DataFactory,
  Quad,
  Quad_Graph,
  Quad_Object,
  Quad_Predicate,
  Quad_Subject,
  Store,
  Stream,
} from 'rdf-js';
import type {
  DelStreamOpts,
  BatchOpts,
  DelOpts,
  PutOpts,
  PatchOpts,
  GetOpts,
  InternalIndex,
  PutStreamOpts,
  Pattern,
  StoreOpts,
  VoidResult,
  TSReadable,
  TermName,
  Prefixes,
  QuadArrayResultWithInternals,
  QuadStreamResultWithInternals,
} from './types';
import { ResultType } from './types';
import type {
  AbstractChainedBatch,
  AbstractLevel,
} from 'abstract-level';
import { EventEmitter } from 'events';
import {
  EmptyIterator,
  wrap,
} from 'asynciterator';
import {
  streamToArray,
  ensureAbstractLevel,
} from './utils/stuff';
import {
  emptyObject,
  defaultIndexes,
  separator,
  levelPutOpts,
  levelDelOpts,
} from './utils/constants';
import { consumeOneByOne } from './utils/consumeonebyone';
import { consumeInBatches } from './utils/consumeinbatches';
import { uid } from './utils/uid';
import { getApproximateSize, getStream } from './get';
import { Scope } from './scope';
import { quadWriter } from './serialization/quads';
import { viewUint16ArrayAsUint8Array } from './serialization/utils';

export class Quadstore implements Store {

  readonly db: AbstractLevel<any, any, any>;

  readonly indexes: InternalIndex[];
  readonly id: string;

  readonly prefixes: Prefixes;

  readonly dataFactory: DataFactory;

  constructor(opts: StoreOpts) {
    ensureAbstractLevel(opts.backend, '"opts.backend"');
    this.dataFactory = opts.dataFactory;
    this.db = opts.backend;
    this.indexes = [];
    this.id = uid();
    (opts.indexes || defaultIndexes)
      .forEach((index: TermName[]) => this._addIndex(index));
    this.prefixes = opts.prefixes || {
      expandTerm: term => term,
      compactIri: iri => iri,
    };
  }

  protected ensureReady() {
    if (this.db.status !== 'open') {
      throw new Error(`Store is not ready (status: "${this.db.status}"). Did you call store.open()?`);
    }
  }

  async open() {
    if (this.db.status !== 'open') {
      await this.db.open();
    }
  }

  async close() {
    if (this.db.status !== 'closed') {
      await this.db.close();
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
      prefix: name + separator,
    });
  }

  async clear(): Promise<void> {
    if (typeof this.db.clear === 'function') {
      return new Promise((resolve, reject) => {
        this.db.clear((err?: Error | null) => {
          err ? reject(err) : resolve();
        });
      });
    }
    await this.delStream((await this.getStream({})).iterator, { batchSize: 20 });
  }

  match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph, opts: GetOpts = emptyObject): Stream<Quad> {
    // This is required due to the fact that Comunica may invoke the `.match()`
    // method in generalized RDF mode, under which the subject may be a literal
    // term.
    // @ts-ignore
    if (subject && subject.termType === 'Literal') {
      return new EmptyIterator();
    }
    const pattern: Pattern = { subject, predicate, object, graph };
    return wrap(this.getStream(pattern, opts).then(results => results.iterator));
  }

  async countQuads(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph, opts: GetOpts = emptyObject): Promise<number> {
    // This is required due to the fact that Comunica may invoke the `.match()`
    // method in generalized RDF mode, under which the subject may be a literal
    // term.
    // @ts-ignore
    if (subject && subject.termType === 'Literal') {
      return 0;
    }
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
    return await getApproximateSize(this, pattern, opts);
  }

  private _batchPut(quad: Quad, value: Uint16Array, baseValueOffset: number, batch: AbstractChainedBatch<any, any, any>): AbstractChainedBatch<any, any, any> {
    const { indexes } = this;
    for (let i = 0, il = indexes.length, index, valueOffset; i < il; i += 1) {
      valueOffset = baseValueOffset + i * 16;
      index = indexes[i];
      const key = quadWriter.write(index.prefix, value, valueOffset, quad, index.terms, this.prefixes);
      batch = batch.put(key, viewUint16ArrayAsUint8Array(value, valueOffset, 16), levelPutOpts);
    }
    return batch;
  }

  async put(quad: Quad, opts: PutOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const { indexes, db } = this;
    let batch = db.batch();
    if (opts.scope) {
      quad = opts.scope.parseQuad(quad, batch);
    }
    const value = new Uint16Array(16 * indexes.length);
    this._batchPut(quad, value, 0, batch);
    await this.writeBatch(batch, opts);
    return { type: ResultType.VOID };
  }

  async multiPut(quads: Quad[], opts: PutOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const { indexes, db } = this;
    const value = new Uint16Array(16 * indexes.length * quads.length);
    let valueOffset = 0;
    let batch = db.batch();
    for (let q = 0, ql = quads.length, quad; q < ql; q += 1) {
      quad = quads[q];
      valueOffset = q * indexes.length * 16;
      if (opts.scope) {
        quad = opts.scope.parseQuad(quad, batch);
      }
      this._batchPut(quad, value, valueOffset, batch);
    }
    await this.writeBatch(batch, opts);
    return { type: ResultType.VOID };
  }

  private _batchDel(quad: Quad, batch: AbstractChainedBatch<any, any, any>): AbstractChainedBatch<any, any, any> {
    const { indexes } = this;
    for (let i = 0, il = indexes.length, index; i < il; i += 1) {
      index = indexes[i];
      const key = quadWriter.write(index.prefix, undefined, 0, quad, index.terms, this.prefixes);
      batch = batch.del(key, levelDelOpts);
    }
    return batch;
  }

  async del(quad: Quad, opts: DelOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batch = this.db.batch();
    this._batchDel(quad, batch);
    await this.writeBatch(batch, opts);
    return { type: ResultType.VOID };
  }

  async multiDel(quads: Quad[], opts: DelOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batch = this.db.batch();
    for (let q = 0, ql = quads.length, quad; q < ql; q += 1) {
      quad = quads[q];
      this._batchDel(quad, batch);
    }
    await this.writeBatch(batch, opts);
    return { type: ResultType.VOID };
  }

  async patch(oldQuad: Quad, newQuad: Quad, opts: PatchOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const { indexes, db } = this;
    const batch = db.batch();
    this._batchDel(oldQuad, batch);
    const value = new Uint16Array(16 * indexes.length);
    this._batchPut(newQuad, value, 0, batch);
    await this.writeBatch(batch, opts);
    return { type: ResultType.VOID };
  }

  async multiPatch(oldQuads: Quad[], newQuads: Quad[], opts: PatchOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const { indexes, db } = this;
    let batch = db.batch();
    for (let oq = 0, oql = oldQuads.length, oldQuad; oq < oql; oq += 1) {
      oldQuad = oldQuads[oq];
      this._batchDel(oldQuad, batch);
    }
    const value = new Uint16Array(16 * indexes.length * newQuads.length);
    let valueOffset = 0;
    for (let nq = 0, nql = newQuads.length, newQuad; nq < nql; nq += 1) {
      valueOffset = nq * indexes.length * 16;
      newQuad = newQuads[nq];
      this._batchPut(newQuad, value, valueOffset, batch);
    }
    await this.writeBatch(batch, opts);
    return { type: ResultType.VOID };
  }

  private async writeBatch(batch: AbstractChainedBatch<any, any, any>, opts: BatchOpts) {
    if (opts.preWrite) {
      await opts.preWrite(batch);
    }
    await batch.write();
  }

  async get(pattern: Pattern, opts: GetOpts = emptyObject): Promise<QuadArrayResultWithInternals> {
    this.ensureReady();
    const results = await this.getStream(pattern, opts);
    const items: Quad[] = await streamToArray(results.iterator);
    return {
      items,
      type: results.type,
      order: results.order,
      index: results.index,
      resorted: results.resorted,
    };
  }

  async getStream(pattern: Pattern, opts: GetOpts = emptyObject): Promise<QuadStreamResultWithInternals> {
    this.ensureReady();
    return await getStream(this, pattern, opts);
  }

  async putStream(source: TSReadable<Quad>, opts: PutStreamOpts = emptyObject): Promise<VoidResult> {
    this.ensureReady();
    const batchSize = opts.batchSize || 1;
    if (batchSize === 1) {
      await consumeOneByOne<Quad>(source, quad => this.put(quad, opts));
    } else {
      await consumeInBatches<Quad>(source, batchSize, quads => this.multiPut(quads, opts));
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

  async initScope(): Promise<Scope> {
    await this.ensureReady();
    return await Scope.init(this);
  }

  async loadScope(scopeId: string): Promise<Scope> {
    await this.ensureReady();
    return await Scope.load(this, scopeId);
  }

  async deleteScope(scopeId: string): Promise<void> {
    await this.ensureReady();
    await Scope.delete(this, scopeId);
  }

  async deleteAllScopes(): Promise<void> {
    await this.ensureReady();
    await Scope.delete(this);
  }

}
