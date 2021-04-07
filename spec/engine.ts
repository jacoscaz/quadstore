
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/sparql/IQueryEngine.ts

import type { Quad, Term } from 'rdf-js';
import type { IQueryEngine, IQueryResult, IUpdateEngine, IQueryResultBindings, IQueryResultBoolean, IQueryResultQuads } from 'rdf-test-suite';
import type {BindingArrayResult, BooleanResult, QuadArrayResult } from '../lib/types';

import memdown from 'memdown';
import { ResultType } from '../lib/types';
import { Quadstore } from '../lib/quadstore';
import { DataFactory } from 'rdf-data-factory';
import { getBindingComparator, getQuadComparator } from '../lib/utils';
import { newEngine } from 'quadstore-comunica';

class RdfStoreQueryEngine implements IQueryEngine, IUpdateEngine {

  async parse(query: string, options: Record<string, any>) {
    // @ts-ignore
    return newEngine().mediatorSparqlParse.mediate({ query, baseIRI: options.baseIRI });
  }

  async update(data: Quad[], queryString: string, options: Record<string, any>): Promise<Quad[]> {
    const store = new Quadstore({
      dataFactory: new DataFactory(),
      backend: memdown(),
      comunica: newEngine(),
    });
    await store.open();
    await store.multiPut(data);
    await store.sparql(queryString, options);
    const results = (await store.get({}));
    await store.close();
    return results.items;
  }

  async query(data: Quad[], queryString: string, options: Record<string, any>): Promise<IQueryResult> {
    const store = new Quadstore({
      dataFactory: new DataFactory(),
      backend: memdown(),
      comunica: newEngine(),
    });
    await store.open();
    await store.multiPut(data);
    const results = await store.sparql(queryString, options);
    let preparedResults: IQueryResult;
    switch (results.type) {
      case ResultType.BINDINGS:
        preparedResults = await this.prepareBindingResult(results);
        break;
      case ResultType.QUADS:
        preparedResults = await this.prepareQuadResult(results);
        break;
      case ResultType.BOOLEAN:
        preparedResults = await this.prepareBooleanResult(results);
        break;
      default:
        throw new Error(`Unsupported`);
    }
    await store.close();
    return preparedResults;
  }

  async prepareBooleanResult(result: BooleanResult): Promise<IQueryResultBoolean> {
    return {
      type: 'boolean',
      value: result.value,
      equals(that: IQueryResult, laxCardinality?: boolean): boolean {
        return that.type === 'boolean' && that.value === result.value;
      },
    };
  }

  async prepareBindingResult(result: BindingArrayResult): Promise<IQueryResultBindings> {
    return {
      type: 'bindings',
      value: result.items,
      checkOrder: false,
      variables: result.variables,
      equals: (that, laxCardinality?: boolean): boolean => {
        if (that.type !== 'bindings') {
          return false;
        }
        return this.compareBindingResult(result.items, that.value, result.variables, laxCardinality);
      },
    };
  }

  compareBindingResult(
    actualBindings: {[variable: string]: Term}[],
    expectedBindings: {[variable: string]: Term}[],
    variables: string[],
    laxCardinality?: boolean,
  ): boolean {
    const comparator = getBindingComparator(variables);
    actualBindings.sort(comparator);
    expectedBindings.sort(comparator);
    for (let i = 0, n = Math.min(actualBindings.length, expectedBindings.length); i < n; i += 1) {
      if (comparator(actualBindings[i], expectedBindings[i]) !== 0) {
        return false;
      }
    }
    return true;
  }

  async prepareQuadResult(result: QuadArrayResult): Promise<IQueryResultQuads> {
    return {
      type: 'quads',
      value: result.items,
      equals: (that, laxCardinality?: boolean): boolean => {
        if (that.type !== 'quads') {
          return false;
        }
        return this.compareQuadResult(result.items, that.value, laxCardinality);
      },
    };
  }

  compareQuadResult(
    actualQuads: Quad[],
    expectedQuads: Quad[],
    laxCardinality?: boolean,
  ): boolean {
    const comparator = getQuadComparator();
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
