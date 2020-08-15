
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/sparql/IQueryEngine.ts

import {Quad, Term} from 'rdf-js';
import {IQueryEngine, IQueryResult, IQueryResultBindings, IQueryResultQuads} from 'rdf-test-suite';
import {RdfStore} from './rdfstore';
import memdown from 'memdown';
import {
  TSRdfBindingArrayResult,
  TSRdfQuadArrayResult,
  TSResultType
} from './types';
import dataFactory from '@rdfjs/data-model';
import {parse} from './sparql';


class RdfStoreQueryEngine implements IQueryEngine {

  public store?: RdfStore;

  async parse(queryString: string, options: Record<string, any>): Promise<void> {
    await parse(queryString);
  }

  async query(data: Quad[], queryString: string, options: Record<string, any>): Promise<IQueryResult> {
    const store = new RdfStore({
      dataFactory,
      backend: memdown(),
    });
    await store.multiPut(data);
    const result = await store.sparql(queryString);
    switch (result.type) {
      case TSResultType.BINDINGS:
        return await this.prepareBindingResult(store, result);
      case TSResultType.QUADS:
        return await this.prepareQuadResult(store, result);
      default:
        throw new Error(`Unsupported`);
    }
  }

  async prepareBindingResult(store: RdfStore, result: TSRdfBindingArrayResult): Promise<IQueryResultBindings> {
    const variables = Object.keys(result.variables);
    return {
      type: 'bindings',
      value: result.items,
      checkOrder: false,
      variables,
      equals: (that, laxCardinality?: boolean): boolean => {
        if (that.type !== 'bindings') {
          return false;
        }
        return this.compareBindingResult(store, result.items, that.value, variables, laxCardinality);
      },
    };
  }

  compareBindingResult(
    store: RdfStore,
    actualBindings: {[variable: string]: Term}[],
    expectedBindings: {[variable: string]: Term}[],
    variables: string[],
    laxCardinality?: boolean,
  ): boolean {
    const comparator = store.getBindingComparator(variables);
    actualBindings.sort(comparator);
    expectedBindings.sort(comparator);
    for (let i = 0, n = Math.min(actualBindings.length, expectedBindings.length); i < n; i += 1) {
      if (comparator(actualBindings[i], expectedBindings[i]) !== 0) {
        return false;
      }
    }
    return true;
  }

  async prepareQuadResult(store: RdfStore, result: TSRdfQuadArrayResult): Promise<IQueryResultQuads> {
    return {
      type: 'quads',
      value: result.items,
      equals: (that, laxCardinality?: boolean): boolean => {
        if (that.type !== 'quads') {
          return false;
        }
        return this.compareQuadResult(store, result.items, that.value, laxCardinality);
      },
    };
  }

  compareQuadResult(
    store: RdfStore,
    actualQuads: Quad[],
    expectedQuads: Quad[],
    laxCardinality?: boolean,
  ): boolean {
    const comparator = store.getQuadComparator();
    actualQuads.sort(comparator);
    expectedQuads.sort(comparator);
    for (let i = 0, n = Math.min(actualQuads.length, expectedQuads.length); i < n; i += 1) {
      if (comparator(actualQuads[i], expectedQuads[i]) !== 0) {
        return false;
      }
    }
    return true;
  }

}

module.exports = new RdfStoreQueryEngine();
