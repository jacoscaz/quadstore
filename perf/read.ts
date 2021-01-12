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
  for (let i = 0; i < qty; i += 1) {
    await store.put(dataFactory.quad(
      dataFactory.namedNode(`ex://s${i}`),
      dataFactory.namedNode(`ex://p${i}`),
      dataFactory.namedNode(`ex://o${i}`),
      dataFactory.namedNode(`ex://g${i}`),
    ));
  }
};

const doReads = async (store: Quadstore) => {
  let count = 0;
  const results = await store.getStream({});
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
  console.log('quad/s', readQty / readTime * 1000);
  console.log('disk usage', diskUsage);
  await store.close();
});

