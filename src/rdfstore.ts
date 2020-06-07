
'use strict';

import * as _ from './utils/lodash';
import * as enums from './utils/enums';
import * as utils from './utils';
import assert from 'assert';
import {EventEmitter} from 'events';
import QuadStore from './quadstore';
import * as serialization from './rdf/serialization';
import * as sparql from './sparql';
import AsyncIterator from 'asynciterator';
import { DataFactory, Term, Store, Quad, NamedNode, BlankNode, DefaultGraph } from 'rdf-js';
import {
  IRSQuad,
  IRSQuadArrayResult,
  IRSRange,
  IRSStore,
  IRSTerms,
  TTermName,
  EResultType,
  IEmptyOpts,
  IReadable,
  IRSStoreOpts, IQSStoreOpts
} from './types';

class RdfStore extends QuadStore implements IRSStore {

  public _dataFactory: DataFactory;

  constructor(opts: IRSStoreOpts) {
    assert(_.isObject(opts), 'Invalid "opts" argument: "opts" is not an object');
    assert(utils.isDataFactory(opts.dataFactory), 'Invalid "opts" argument: "opts.dataFactory" is not an instance of DataFactory');
    const superOpts: IQSStoreOpts = {
      ...opts,
      defaultGraph: opts.defaultGraph
        ? serialization.importSimpleTerm(opts.defaultGraph, true, 'urn:rdfstore:dg')
        : 'urn:quadstore:dg',
    };
    super(superOpts);
    this._dataFactory = opts.dataFactory;
  }


  // **************************************************************************
  // ******************************** RDF/JS **********************************
  // **************************************************************************


  match(subject?: Term, predicate?: Term, object?: Term, graph?: Term): IReadable<Quad> {
    const iterator = new AsyncIterator.TransformIterator<Quad, Quad>();
    const matchTerms = { subject, predicate, object, graph };
    this.getStream(matchTerms, {})
      .then((results) => { iterator.source = results.iterator; })
      .catch((err) => {
        // TODO: is the destroy() method really suppored by AsyncIterator?
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
  removeMatches(subject?: Term, predicate?: Term, object?: Term, graph?: Term) {
    const source = this.match(subject, predicate, object, graph);
    return this.remove(source);
  }

  /**
   * RDF/JS.Store.deleteGraph()
   * @param graph
   * @returns {*}
   */
  deleteGraph(graph: NamedNode|BlankNode|DefaultGraph) {
    return this.removeMatches(undefined, undefined, undefined, graph);
  }

  // **************************************************************************
  // ******************************* ARRAY API ********************************
  // **************************************************************************

  async getApproximateSize(matchTerms: IBaseTerms<Term>, opts: TEmptyOpts) {
    const importedTerms = serialization.importTerms(matchTerms, this._defaultGraph, true, false);
    return await super.getApproximateSize(importedTerms, opts);
  }

  async sparql(query: string, opts: TEmptyOpts) {
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

  // **************************************************************************
  // ******************************* STREAM API *******************************
  // **************************************************************************

  async getStream(matchTerms: IBaseTerms<Term>, opts: TEmptyOpts) {
    if (_.isNil(matchTerms)) matchTerms = {};
    if (_.isNil(opts)) opts = {};
    assert(_.isObject(matchTerms), 'The "matchTerms" argument is not an object.');
    assert(_.isObject(opts), 'The "opts" argument is not an object.');
    const importedMatchTerms: IBaseTerms<string> = {};
    if (matchTerms.subject) {
      importedMatchTerms.subject = this._importTerm(matchTerms.subject, false, true, false);
    }
    if (matchTerms.predicate) {
      importedMatchTerms.predicate = this._importTerm(matchTerms.predicate, false, true, false);
    }
    if (matchTerms.object) {
      importedMatchTerms.object = this._importTerm(matchTerms.object, false, true, false);
    }
    if (matchTerms.graph) {
      importedMatchTerms.graph = this._importTerm(matchTerms.graph, true, true, false);
    }
    const results = await QuadStore.prototype.getStream.call(this, importedMatchTerms, opts);
    return { iterator: results.iterator.map(this._createQuadDeserializerMapper()), sorting: results.sorting };
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
      return serialization.exportTerms(binding, this._defaultGraph, this._dataFactory);
    });
    return { type: results.type, variables: results.variables, iterator };
  }

  async sparqlStream(query: string, opts: TEmptyOpts) {
    if (_.isNil(opts)) opts = {};
    return await sparql.sparqlStream(this, query, opts);
  }



  _isQuad(obj) {
    return QuadStore.prototype._isQuad.call(this, obj)
      && _.isFunction(obj.equals);
  }

  _importTerm(term, isGraph, rangeBoundaryAllowed = false) {
    return serialization.importTerm(term, isGraph, this._defaultGraph, rangeBoundaryAllowed);
  }

  _importQuad(quad) {
    return serialization.importQuad(quad, this._defaultGraph);
  }

  _createQuadDeserializerMapper() {
    return (quad) => {
      return serialization.exportQuad(quad, this._defaultGraph, this._dataFactory);
    };
  }

  _getTermValueComparator() {
    return (a: Term, b: Term) => {
      // @ts-ignore
      const aSerializedValue = a._serializedValue || serialization.importTerm(a, false, this._defaultGraph, true, false);
      // @ts-ignore
      const bSerializedValue = b._serializedValue || serialization.importTerm(b, false, this._defaultGraph, true, false);
      if (aSerializedValue < bSerializedValue) return -1;
      else if (aSerializedValue === bSerializedValue) return 0;
      else return 1;
    };
  }

}

module.exports = RdfStore;
