/*
 * This benchmark was ported from LevelGraph's searchStream.js benchmark
 * https://github.com/levelgraph/levelgraph/tree/d918ff445e78e22410b4b5388e33af4a4cbcec8c/benchmarks
 */

import {Quadstore} from '../lib/quadstore';
import {BindingStreamResult} from '../lib/types';
import {disk, time} from './utils';
import {waitForEvent} from '../lib/utils';
import {DataFactory} from 'rdf-data-factory';

const dataFactory = new DataFactory();
const qty = 200000;

const doWrites = async (store: Quadstore) => {
  const vertexes = ["a", "b"];
  for (let i = 0; i < qty; i += 1) {
    vertexes.pop();
    vertexes.unshift("v" + i);
    await store.put(dataFactory.quad(
      dataFactory.namedNode(`ex://${vertexes[0]}`),
      dataFactory.namedNode("ex://p"),
      dataFactory.namedNode(`ex://${vertexes[1]}`),
      dataFactory.namedNode("ex://g"),
    ));
  }
};

const doReads = async (store: Quadstore) => {
  let count = 0;
  const results = <BindingStreamResult>(await store.sparqlStream(`
    SELECT *
    WHERE { 
      ?a <ex://p> ?b .
      ?b <ex://p> ?c .
    }
  `));
  results.iterator.on('data', () => {
    count++;
  });
  results.iterator.on('error', (err) => {
    console.error(err);
  });
  await waitForEvent(results.iterator, 'end');
  return count;
};

disk(async (backend, checkDiskUsage) => {
  const store = new Quadstore({
    backend,
    dataFactory,
  });
  await store.open();
  await doWrites(store);
  console.log('written to disk');
  const { time: readTime, value: readQty } = await time(() => doReads(store));
  const diskUsage = await checkDiskUsage();
  console.log('total time', readTime);
  console.log('total data', readQty);
  console.log('join result/s', readQty / readTime * 1000);
  console.log('disk usage', diskUsage);
  await store.close();
});

