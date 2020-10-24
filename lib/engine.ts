
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/sparql/IQueryEngine.ts

import {Quad, Term} from 'rdf-js';
import {IQueryEngine, IQueryResult, IQueryResultBindings, IQueryResultQuads} from 'rdf-test-suite';
import {Quadstore} from './quadstore';
import memdown from 'memdown';
import {
  BindingArrayResult,
  QuadArrayResult,
  ResultType
} from './types';
import dataFactory from '@rdfjs/data-model';
import {parse} from './sparql';

class RdfStoreQueryEngine implements IQueryEngine {

  public store?: Quadstore;

  async parse(queryString: string, options: Record<string, any>): Promise<void> {
    const store = new Quadstore({
      dataFactory,
      backend: memdown(),
    });
    await parse(store, queryString);
  }

  async query(data: Quad[], queryString: string, options: Record<string, any>): Promise<IQueryResult> {
    const store = new Quadstore({
      dataFactory,
      backend: memdown(),
    });
    await store.open();
    await store.multiPut(data);
    const results = await store.sparql(queryString);
    let preparedResults: IQueryResult;
    switch (results.type) {
      case ResultType.BINDINGS:
        preparedResults = await this.prepareBindingResult(store, results);
        break;
      case ResultType.QUADS:
        preparedResults = await this.prepareQuadResult(store, results);
        break;
      default:
        throw new Error(`Unsupported`);
    }
    await store.close();
    return preparedResults;
  }

  async prepareBindingResult(store: Quadstore, result: BindingArrayResult): Promise<IQueryResultBindings> {
    return {
      type: 'bindings',
      value: result.items,
      checkOrder: false,
      variables: result.variables,
      equals: (that, laxCardinality?: boolean): boolean => {
        if (that.type !== 'bindings') {
          return false;
        }
        return this.compareBindingResult(store, result.items, that.value, result.variables, laxCardinality);
      },
    };
  }

  compareBindingResult(
    store: Quadstore,
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

  async prepareQuadResult(store: Quadstore, result: QuadArrayResult): Promise<IQueryResultQuads> {
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
    store: Quadstore,
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
