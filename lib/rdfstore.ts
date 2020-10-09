
'use strict';

import {
  isObject,
  isNil,
  streamToArray,
  isReadableStream,
  isDataFactory,
  isString, termNames,
} from './utils/index.js';
import assert from 'assert';
import {EventEmitter} from 'events';
import {QuadStore} from './quadstore.js';
import { RdfSerialization } from './rdf/serialization';
import {sparqlStream} from './sparql/index.js';
import {TransformIterator, AsyncIterator} from 'asynciterator';
import {
  DataFactory,
  Quad,
  Quad_Graph,
  Quad_Object,
  Quad_Predicate,
  Quad_Subject,
  Store,
  Stream,
  Term,
  Literal,
} from 'rdf-js';
import {
  TSPutStreamOpts,
  TSBinding,
  TSEmptyOpts,
  TSGetOpts,
  TSPattern,
  TSQuad,
  TSRdfBindingArrayResult,
  TSRdfBindingStreamResult,
  TSRdfPattern,
  TSRdfQuad,
  TSRdfQuadArrayResult,
  TSRdfQuadStreamResult,
  TSRdfSearchStage,
  TSRdfStore,
  TSRdfStoreOpts,
  TSRdfVoidResult,
  TSReadable,
  TSResultType,
  TSSearchStage,
  TSStoreOpts,
  TSDelStreamOpts, TSSparqlOpts, TSSearchOpts, TSTermName, TSRdfBinding,
} from './types/index.js';

export class RdfStore extends EventEmitter implements TSRdfStore, Store {

  readonly quadstore: QuadStore;
  readonly dataFactory: DataFactory;
  readonly serialization: RdfSerialization;

  constructor(opts: TSRdfStoreOpts) {
    super();
    assert(isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
    const {dataFactory} = opts;
    this.dataFactory = dataFactory;
    this.serialization = new RdfSerialization(opts.prefixes ?? {
      expandTerm: term => term,
      compactIri: iri => iri
    });
    const quadstoreOpts: TSStoreOpts = {
      ...opts,
      defaultGraph: this.serialization.importSimpleTerm(dataFactory.defaultGraph(), true, 'urn:rdfstore:dg'),
    };
    this.quadstore = new QuadStore(quadstoreOpts);
    this.quadstore.on('ready', () => {
      this.emit('ready');
    });

  }

  async close() {
    await this.quadstore.close();
  }

  // **************************************************************************
  // ******************************** RDF/JS **********************************
  // **************************************************************************


  match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph): Stream<Quad> {
    const iterator = new TransformIterator<Quad, Quad>();
    const pattern: TSRdfPattern = { subject, predicate, object, graph };
    this.getStream(pattern, {})
      .then((results) => {
        iterator.source = <AsyncIterator<Quad>>results.iterator;
      })
      .catch((err) => {
        // TODO: is the destroy() method really supported by AsyncIterator?
        // @ts-ignore
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
    assert(isReadableStream(source), 'The "source" argument is not a readable stream.');
    const emitter = new EventEmitter();
    this.putStream(<TSReadable<TSRdfQuad>>source, {})
      .then(() => { emitter.emit('end'); })
      .catch((err) => { emitter.emit('error', err); });
    return emitter;
  }

  remove(source: Stream<Quad>): EventEmitter {
    assert(isReadableStream(source), 'The "source" argument is not a readable stream.');
    const emitter = new EventEmitter();
    this.delStream(<TSReadable<TSRdfQuad>>source, {})
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

  async getApproximateSize(pattern: TSRdfPattern, opts: TSEmptyOpts) {
    const importedTerms: TSPattern = this.serialization.importPattern(pattern, this.quadstore.defaultGraph);
    return await this.quadstore.getApproximateSize(importedTerms, opts);
  }

  async sparql(query: string, opts?: TSSparqlOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult|TSRdfVoidResult> {
    if (isNil(opts)) opts = {};
    assert(isString(query), 'The "query" argument is not an array.');
    assert(isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.sparqlStream(query, opts);
    switch (results.type) {
      case TSResultType.BINDINGS: {
        const bindings = await streamToArray(results.iterator);
        return {...results, items: bindings};
      } break;
      case TSResultType.VOID: {
        return results;
      } break;
      case TSResultType.QUADS: {
        const quads = await streamToArray(results.iterator);
        return {...results, items: quads};
      }
      default:
        // @ts-ignore
        throw new Error(`Unsupported results type "${results.type}"`);
    }
  }

  async put(quad: TSRdfQuad, opts: TSEmptyOpts | undefined = {}): Promise<TSRdfVoidResult> {
    return await this.quadstore.put(this.serialization.importQuad(quad, this.quadstore.defaultGraph), opts);
  }

  async multiPut(quads: TSRdfQuad[], opts: TSEmptyOpts | undefined = {}): Promise<TSRdfVoidResult> {
    const importedQuads = quads.map(quad => this.serialization.importQuad(quad, this.quadstore.defaultGraph));
    return await this.quadstore.multiPut(importedQuads, opts);
  }

  async del(oldQuad: TSRdfQuad, opts: TSEmptyOpts): Promise<TSRdfVoidResult> {
    return await this.quadstore.del(this.serialization.importQuad(oldQuad, this.quadstore.defaultGraph), opts);
  }

  async multiDel(oldQuads: TSRdfQuad[], opts: TSEmptyOpts): Promise<TSRdfVoidResult> {
    let importedOldQuads = oldQuads.map(quad => this.serialization.importQuad(quad, this.quadstore.defaultGraph));
    return await this.quadstore.multiDel(importedOldQuads, opts);
  }

  async patch(oldQuad: TSRdfQuad, newQuad: TSRdfQuad, opts: TSEmptyOpts): Promise<TSRdfVoidResult> {
    return await this.quadstore.patch(
      this.serialization.importQuad(oldQuad, this.quadstore.defaultGraph),
      this.serialization.importQuad(newQuad, this.quadstore.defaultGraph),
      opts,
    );
  }

  async multiPatch(oldQuads: TSRdfQuad[], newQuads: TSRdfQuad[], opts: TSEmptyOpts): Promise<TSRdfVoidResult> {
    const importedOldQuads = oldQuads.map(quad => this.serialization.importQuad(quad, this.quadstore.defaultGraph));
    const importedNewQuads = newQuads.map(quad => this.serialization.importQuad(quad, this.quadstore.defaultGraph));
    return await this.quadstore.multiPatch(importedOldQuads, importedNewQuads, opts);
  }

  async get(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadArrayResult> {
    const results = await this.getStream(pattern, opts);
    const items: TSRdfQuad[] = await streamToArray(results.iterator);
    return { type: results.type, items, sorting: results.sorting };
  }

  async search(stages: TSRdfSearchStage[], opts: TSSearchOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult> {
    const importedStages: TSSearchStage[] = stages.map(stage => this.serialization.importSearchStage(stage, this.quadstore.defaultGraph));
    const result = await this.quadstore.search(importedStages, opts);
    switch (result.type) {
      case TSResultType.QUADS:
        return {
          ...result,
          items: result.items.map(
            quad => this.serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory)
          ),
        };
      case TSResultType.BINDINGS:
        return {
          ...result,
          items: result.items.map(
            binding => this.serialization.exportBinding(binding, this.quadstore.defaultGraph, this.dataFactory)
          ),
        };
      default:
        // @ts-ignore
        throw new Error(`Unsupported result type "${result.type}"`);
    }
  }


  // **************************************************************************
  // ******************************* STREAM API *******************************
  // **************************************************************************

  async getStream(pattern: TSRdfPattern, opts?: TSEmptyOpts): Promise<TSRdfQuadStreamResult> {
    if (isNil(pattern)) pattern = {};
    if (isNil(opts)) opts = {};
    assert(isObject(pattern), 'The "matchTerms" argument is not an object.');
    assert(isObject(opts), 'The "opts" argument is not an object.');
    const importedMatchTerms: TSPattern = this.serialization.importPattern(pattern, this.quadstore.defaultGraph);
    const results = await this.quadstore.getStream(importedMatchTerms, opts);
    return {
      type: TSResultType.QUADS,
      iterator: results.iterator.map(this._createQuadDeserializerMapper()),
      sorting: results.sorting,
    };
  }

  async putStream(source: TSReadable<TSRdfQuad>, opts?: TSPutStreamOpts): Promise<TSRdfVoidResult> {
    // @ts-ignore
    const importedQuadsIterator: TSReadable<TSQuad> = new TransformIterator(source)
      .map(this._createQuadSerializerMapper());
    return await this.quadstore.putStream(importedQuadsIterator, opts);
  }

  async delStream(source: TSReadable<TSRdfQuad>, opts?: TSDelStreamOpts): Promise<TSRdfVoidResult> {
    // @ts-ignore
    const importedQuadsIterator: TSReadable<TSQuad> = new TransformIterator(source)
      .map(this._createQuadSerializerMapper());
    return await this.quadstore.delStream(importedQuadsIterator, opts);
  }

  async searchStream(stages: TSRdfSearchStage[], opts?: TSSearchOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult> {
    if (isNil(opts)) opts = {};
    const importedStages: TSSearchStage[] = stages.map(stage => this.serialization.importSearchStage(stage, this.quadstore.defaultGraph));
    const results = await this.quadstore.searchStream(importedStages, opts);
    let iterator;
    switch (results.type) {
      case TSResultType.BINDINGS:
        iterator = results.iterator.map((binding: TSBinding) => {
          return this.serialization.exportBinding(binding, this.quadstore.defaultGraph, this.dataFactory);
        });
        return { ...results, iterator };
      case TSResultType.QUADS:
        iterator = results.iterator.map((quad: TSQuad) => {
          return this.serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
        });
        return { ...results, iterator };
      default:
        // @ts-ignore
        throw new Error(`Unsupported result type "${results.type}"`);
    }
  }

  async sparqlStream(query: string, opts?: TSSparqlOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult|TSRdfVoidResult> {
    if (isNil(opts)) opts = {};
    return await sparqlStream(this, query, opts);
  }


  _createQuadSerializerMapper(): (quad: TSRdfQuad) => TSQuad {
    return (quad: TSRdfQuad): TSQuad => {
      return this.serialization.importQuad(quad, this.quadstore.defaultGraph);
    }
  }

  _createQuadDeserializerMapper(): (quad: TSQuad) => TSRdfQuad {
    return (quad: TSQuad): TSRdfQuad => {
      return this.serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
    };
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

  getQuadComparator(_termNames: TSTermName[] = termNames): (a: Quad, b: Quad) => (-1 | 0 | 1) {
    const termComparator = this.getTermComparator();
    return (a: Quad, b: Quad) => {
      for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
        r = termComparator(a[_termNames[i]], b[_termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

  getBindingComparator(_termNames: string[]): (a: TSRdfBinding, b: TSRdfBinding) => -1|0|1 {
    const termComparator = this.getTermComparator();
    return (a: TSRdfBinding, b: TSRdfBinding) => {
      for (let i = 0, n = _termNames.length, r: -1|0|1; i < n; i += 1) {
        r = termComparator(a[_termNames[i]], b[_termNames[i]]);
        if (r !== 0) return r;
      }
      return 0;
    };
  }

}
