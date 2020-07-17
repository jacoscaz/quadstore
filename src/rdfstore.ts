
'use strict';

import * as _ from './utils/lodash';
import * as utils from './utils';
import assert from 'assert';
import {EventEmitter} from 'events';
import QuadStore from './quadstore';
import * as serialization from './rdf/serialization';
import * as sparql from './sparql';
import ai from 'asynciterator';
import {DataFactory, Quad, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Store} from 'rdf-js';
import {
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
} from './types';

class RdfStore extends EventEmitter implements TSRdfStore, Store {

  readonly quadstore: QuadStore;
  readonly dataFactory: DataFactory;

  constructor(opts: TSRdfStoreOpts) {
    super();
    assert(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(utils.isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
    const {dataFactory} = opts;
    this.dataFactory = dataFactory;
    const quadstoreOpts: TSStoreOpts = {
      ...opts,
      defaultGraph: serialization.importSimpleTerm(dataFactory.defaultGraph(), true, 'urn:rdfstore:dg'),
    };
    this.quadstore = new QuadStore(quadstoreOpts);
    this.quadstore.on('ready', () => {
      this.emit('ready');
    });

  }


  // **************************************************************************
  // ******************************** RDF/JS **********************************
  // **************************************************************************


  match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph): TSReadable<Quad> {
    const iterator = new ai.TransformIterator<Quad, Quad>();
    const pattern: TSRdfPattern = { subject, predicate, object, graph };
    this.getStream(pattern, {})
      .then((results) => {
        iterator.source = results.iterator;
      })
      .catch((err) => {
        // TODO: is the destroy() method really supported by AsyncIterator?
        // @ts-ignore
        iterator.destroy();
      });
    return iterator;
  }

  /**
   * RDF/JS.Sink.import()
   * @param source
   * @param opts
   * @returns {*|EventEmitter}
   */
  import(source: TSReadable<TSRdfQuad>): EventEmitter {
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    const emitter = new EventEmitter();
    this.putStream(source, {})
      .then(() => { emitter.emit('end'); })
      .catch((err) => { emitter.emit('error', err); });
    return emitter;
  }

  remove(source: TSReadable<TSRdfQuad>): EventEmitter {
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    const emitter = new EventEmitter();
    this.delStream(source, {})
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
    const importedTerms: TSPattern = serialization.importPattern(pattern, this.quadstore.defaultGraph);
    return await this.quadstore.getApproximateSize(importedTerms, opts);
  }

  async sparql(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult|TSRdfVoidResult> {
    if (_.isNil(opts)) opts = {};
    assert(_.isString(query), 'The "query" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.sparqlStream(query, opts);
    switch (results.type) {
      case TSResultType.BINDINGS: {
        const bindings = await utils.streamToArray(results.iterator);
        return {...results, items: bindings};
      } break;
      case TSResultType.VOID: {
        return results;
      } break;
      case TSResultType.QUADS: {
        const quads = await utils.streamToArray(results.iterator);
        return {...results, items: quads};
      }
      default:
        // @ts-ignore
        throw new Error(`Unsupported results type "${results.type}"`);
    }
  }

  async put(quads: TSRdfQuad | TSRdfQuad[], opts: TSEmptyOpts | undefined = {}): Promise<void> {
    const importedQuads = Array.isArray(quads)
      ? quads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph))
      : serialization.importQuad(quads, this.quadstore.defaultGraph);
    return await this.quadstore.put(importedQuads, opts);
  }

  async del(patternOrOldQuads: TSRdfQuad | TSRdfPattern | TSRdfQuad[], opts: TSEmptyOpts): Promise<void> {
    let importedPatternOrOldQuads: TSQuad|TSQuad[]|TSPattern;
    if (Array.isArray(patternOrOldQuads)) {
      importedPatternOrOldQuads = patternOrOldQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph));
    } else if (utils.hasAllTerms(patternOrOldQuads)) {
      importedPatternOrOldQuads = serialization.importQuad(<TSRdfQuad>patternOrOldQuads, this.quadstore.defaultGraph);
    } else {
      importedPatternOrOldQuads = serialization.importPattern(patternOrOldQuads, this.quadstore.defaultGraph);
    }
    return await this.quadstore.del(importedPatternOrOldQuads, opts);
  }

  async get(pattern: TSRdfPattern, opts: TSGetOpts): Promise<TSRdfQuadArrayResult> {
    const results = await this.getStream(pattern, opts);
    const items: TSRdfQuad[] = await utils.streamToArray(results.iterator);
    return { type: results.type, items, sorting: results.sorting };
  }

  async patch(matchTermsOrOldQuads: TSRdfQuad | TSRdfPattern | TSRdfQuad[], newQuads: TSRdfQuad | TSRdfQuad[], opts: TSEmptyOpts): Promise<void> {
    let importedPatternOrOldQuads: TSQuad|TSQuad[]|TSPattern;
    if (Array.isArray(matchTermsOrOldQuads)) {
      importedPatternOrOldQuads = matchTermsOrOldQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph));
    } else if (utils.hasAllTerms(matchTermsOrOldQuads)) {
      importedPatternOrOldQuads = serialization.importQuad(<TSRdfQuad>matchTermsOrOldQuads, this.quadstore.defaultGraph);
    } else {
      importedPatternOrOldQuads = serialization.importPattern(matchTermsOrOldQuads, this.quadstore.defaultGraph);
    }
    const importedNewQuads: TSQuad|TSQuad[] = Array.isArray(newQuads)
      ? newQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph))
      : serialization.importQuad(newQuads, this.quadstore.defaultGraph);
    return await this.quadstore.patch(importedPatternOrOldQuads, importedNewQuads, opts);
  }

  async search(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadArrayResult|TSRdfBindingArrayResult> {
    const importedStages: TSSearchStage[] = stages.map(stage => serialization.importSearchStage(stage, this.quadstore.defaultGraph));
    const result = await this.quadstore.search(importedStages, opts);
    switch (result.type) {
      case TSResultType.QUADS:
        return {...result, items: result.items.map(quad => serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory))};
      case TSResultType.BINDINGS:
        return {...result, items: result.items.map(binding => serialization.exportBinding(binding, this.quadstore.defaultGraph, this.dataFactory))};
      default:
        // @ts-ignore
        throw new Error(`Unsupported result type "${result.type}"`);
    }

  }


  // **************************************************************************
  // ******************************* STREAM API *******************************
  // **************************************************************************

  async getStream(pattern: TSRdfPattern, opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult> {
    if (_.isNil(pattern)) pattern = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(pattern), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const importedMatchTerms: TSPattern = serialization.importPattern(pattern, this.quadstore.defaultGraph);
    const results = await this.quadstore.getStream(importedMatchTerms, opts);
    return {
      type: TSResultType.QUADS,
      iterator: results.iterator.map(this._createQuadDeserializerMapper()),
      sorting: results.sorting,
    };
  }

  async putStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void> {
    // @ts-ignore
    const importedQuadsIterator: TSReadable<TSQuad> = ai.AsyncIterator.wrap(source)
      .map(this._createQuadSerializerMapper());
    return await this.quadstore.putStream(importedQuadsIterator, opts);
  }

  async delStream(source: TSReadable<TSRdfQuad>, opts: TSEmptyOpts): Promise<void> {
    // @ts-ignore TODO: fix typings so that IReadable aligns with AsyncIterator
    const importedQuadsIterator: TSReadable<TSQuad> = ai.AsyncIterator.wrap(source)
      .map(this._createQuadSerializerMapper());
    return await this.quadstore.delStream(importedQuadsIterator, opts);
  }

  async searchStream(stages: TSRdfSearchStage[], opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult> {
    if (_.isNil(opts)) opts = {};
    const importedStages: TSSearchStage[] = stages.map(stage => serialization.importSearchStage(stage, this.quadstore.defaultGraph));
    const results = await this.quadstore.searchStream(importedStages, opts);
    let iterator;
    switch (results.type) {
      case TSResultType.BINDINGS:
        iterator = results.iterator.map((binding: TSBinding) => {
          return serialization.exportBinding(binding, this.quadstore.defaultGraph, this.dataFactory);
        });
        break;
      case TSResultType.QUADS:
        iterator = results.iterator.map((quad: TSQuad) => {
          return serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
        });
        break;
      default:
        throw new Error(`Unsupported result type "${results.type}"`);
    }
    return { ...results, iterator };
  }

  async sparqlStream(query: string, opts: TSEmptyOpts): Promise<TSRdfQuadStreamResult|TSRdfBindingStreamResult|TSRdfVoidResult> {
    if (_.isNil(opts)) opts = {};
    return await sparql.sparqlStream(this, query, opts);
  }


  _createQuadSerializerMapper(): (quad: TSRdfQuad) => TSQuad {
    return (quad: TSRdfQuad): TSQuad => {
      return serialization.importQuad(quad, this.quadstore.defaultGraph);
    }
  }

  _createQuadDeserializerMapper(): (quad: TSQuad) => TSRdfQuad {
    return (quad: TSQuad): TSRdfQuad => {
      return serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
    };
  }

}

export default RdfStore;
