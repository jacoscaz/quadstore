
'use strict';

import * as _ from './utils/lodash';
import * as enums from './utils/enums';
import * as utils from './utils';
import assert from 'assert';
import {EventEmitter} from 'events';
import QuadStore from './quadstore';
import * as serialization from './rdf/serialization';
import * as sparql from './sparql';
import ai from 'asynciterator';
import {BlankNode, DataFactory, DefaultGraph, NamedNode, Quad, Term, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Store} from 'rdf-js';
import {
  EResultType,
  IEmptyOpts,
  IQSQuad,
  IQSStoreOpts,
  IQSTerms,
  IReadable,
  IRSQuad, IRSQuadArrayResult,
  IRSQuadStreamResult,
  IRSStore,
  IRSStoreOpts,
  IRSTerms
} from './types';
import { IBaseGetOpts } from './types/base';

class RdfStore extends EventEmitter implements IRSStore, Store {

  readonly quadstore: QuadStore;
  readonly dataFactory: DataFactory;

  constructor(opts: IRSStoreOpts) {
    super();
    assert(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(utils.isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
    const quadstoreOpts: IQSStoreOpts = {
      ...opts,
      defaultGraph: opts.defaultGraph
        ? serialization.importSimpleTerm(opts.defaultGraph, true, 'urn:rdfstore:dg')
        : 'urn:quadstore:dg',
    };
    this.quadstore = new QuadStore(quadstoreOpts);
    this.dataFactory = opts.dataFactory;
  }


  // **************************************************************************
  // ******************************** RDF/JS **********************************
  // **************************************************************************


  match(subject?: Quad_Subject, predicate?: Quad_Predicate, object?: Quad_Object, graph?: Quad_Graph): IReadable<Quad> {
    const iterator = new ai.TransformIterator<Quad, Quad>();
    const matchTerms: IRSTerms = { subject, predicate, object, graph };
    this.getStream(matchTerms, {})
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
  import(source: IReadable<IRSQuad>): EventEmitter {
    assert(utils.isReadableStream(source), 'The "source" argument is not a readable stream.');
    const emitter = new EventEmitter();
    this.putStream(source, {})
      .then(() => { emitter.emit('end'); })
      .catch((err) => { emitter.emit('error', err); });
    return emitter;
  }

  remove(source: IReadable<Quad>): EventEmitter {
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

  async getApproximateSize(matchTerms: IRSTerms, opts: IEmptyOpts) {
    const importedTerms: IQSTerms = serialization.importTerms(matchTerms, this.quadstore.defaultGraph);
    return await this.quadstore.getApproximateSize(importedTerms, opts);
  }

  async sparql(query: string, opts: IEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    assert(_.isString(query), 'The "query" argument is not an array.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const results = await this.sparqlStream(query, opts);
    switch (results.type) {
      case enums.resultType.BINDINGS: {
        const bindings = await utils.streamToArray(results.iterator);
        return {type: results.type, variables: results.variables, bindings, sorting: results.sorting};
      } break;
      default:
        throw new Error(`Unsupported results type "${results.type}"`);
    }
  }

  async put(quads: IRSQuad | IRSQuad[], opts: IEmptyOpts | undefined = {}): Promise<void> {
    const importedQuads = Array.isArray(quads)
      ? quads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph))
      : serialization.importQuad(quads, this.quadstore.defaultGraph);
    return await this.quadstore.put(importedQuads, opts);
  }

  async del(matchTermsOrOldQuads: IRSQuad | IRSTerms | IRSQuad[], opts: IEmptyOpts): Promise<void> {
    let importedMatchTermsOrOldQuads: IQSQuad|IQSQuad[]|IQSTerms;
    if (Array.isArray(matchTermsOrOldQuads)) {
      importedMatchTermsOrOldQuads = matchTermsOrOldQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph));
    } else if (utils.hasAllTerms(matchTermsOrOldQuads)) {
      importedMatchTermsOrOldQuads = serialization.importQuad(<IRSQuad>matchTermsOrOldQuads, this.quadstore.defaultGraph);
    } else {
      importedMatchTermsOrOldQuads = serialization.importTerms(matchTermsOrOldQuads, this.quadstore.defaultGraph);
    }
    return await this.quadstore.del(importedMatchTermsOrOldQuads, opts);
  }
  async get(matchTerms: IRSTerms, opts: IBaseGetOpts): Promise<IRSQuadArrayResult> {
    const results = await this.getStream(matchTerms, opts);
    const items: IRSQuad[] = await utils.streamToArray(results.iterator);
    return { type: results.type, items, sorting: results.sorting };
  }

  async patch(matchTermsOrOldQuads: IRSQuad | IRSTerms | IRSQuad[], newQuads: IRSQuad | IRSQuad[], opts: IEmptyOpts): Promise<void> {
    let importedMatchTermsOrOldQuads: IQSQuad|IQSQuad[]|IQSTerms;
    if (Array.isArray(matchTermsOrOldQuads)) {
      importedMatchTermsOrOldQuads = matchTermsOrOldQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph));
    } else if (utils.hasAllTerms(matchTermsOrOldQuads)) {
      importedMatchTermsOrOldQuads = serialization.importQuad(<IRSQuad>matchTermsOrOldQuads, this.quadstore.defaultGraph);
    } else {
      importedMatchTermsOrOldQuads = serialization.importTerms(matchTermsOrOldQuads, this.quadstore.defaultGraph);
    }
    const importedNewQuads: IQSQuad|IQSQuad[] = Array.isArray(newQuads)
      ? newQuads.map(quad => serialization.importQuad(quad, this.quadstore.defaultGraph))
      : serialization.importQuad(newQuads, this.quadstore.defaultGraph);
    return await this.quadstore.patch(importedMatchTermsOrOldQuads, importedNewQuads, opts);
  }


  // **************************************************************************
  // ******************************* STREAM API *******************************
  // **************************************************************************

  async getStream(matchTerms: IRSTerms, opts: IEmptyOpts): Promise<IRSQuadStreamResult> {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const importedMatchTerms: IQSTerms = serialization.importTerms(matchTerms, this.quadstore.defaultGraph);
    const results = await this.quadstore.getStream(importedMatchTerms, opts);
    return {
      type: EResultType.QUADS,
      iterator: results.iterator.map(this._createQuadDeserializerMapper()),
      sorting: results.sorting,
    };
  }

  async putStream(source: IReadable<IRSQuad>, opts: IEmptyOpts): Promise<void> {
    // @ts-ignore TODO: fix typings so that IReadable aligns with AsyncIterator
    const importedQuadsIterator: IReadable<IQSQuad> = ai.AsyncIterator.wrap(source)
      .map(this._createQuadSerializerMapper());
    return await this.quadstore.putStream(importedQuadsIterator, opts);
  }

  async delStream(source: IReadable<IRSQuad>, opts: IEmptyOpts): Promise<void> {
    // @ts-ignore TODO: fix typings so that IReadable aligns with AsyncIterator
    const importedQuadsIterator: IReadable<IQSQuad> = ai.AsyncIterator.wrap(source)
      .map(this._createQuadSerializerMapper());
    return await this.quadstore.delStream(importedQuadsIterator, opts);
  }

  async searchStream(patterns, filters, opts) {
    if (_.isNil(opts)) opts = {};
    const importedPatterns = patterns.map(
      pattern => serialization.importTerms(pattern, this._defaultGraph, true, false)
    );
    const importedFilters = filters.map((filter) => {
      return {
        type: filter.type,
        args: filter.args.map(arg => serialization.importTerm(arg, false, this._defaultGraph, true, false)),
      };
    });
    const results = await QuadStore.prototype.searchStream.call(this, importedPatterns, importedFilters, opts);
    const iterator = results.iterator.map((binding) => {
      return serialization.exportTerms(binding, this._defaultGraph, this.dataFactory);
    });
    return { type: results.type, variables: results.variables, iterator };
  }

  async sparqlStream(query: string, opts: TEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    return await sparql.sparqlStream(this, query, opts);
  }


  _createQuadSerializerMapper(): (quad: IRSQuad) => IQSQuad {
    return (quad: IRSQuad): IQSQuad => {
      return serialization.importQuad(quad, this.quadstore.defaultGraph);
    }
  }

  _createQuadDeserializerMapper(): (quad: IQSQuad) => IRSQuad {
    return (quad: IQSQuad): IRSQuad => {
      return serialization.exportQuad(quad, this.quadstore.defaultGraph, this.dataFactory);
    };
  }

}

module.exports = RdfStore;
