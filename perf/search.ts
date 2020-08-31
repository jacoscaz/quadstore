/*
 * This benchmark was ported from LevelGraph's searchStream.js benchmark
 * https://github.com/levelgraph/levelgraph/tree/d918ff445e78e22410b4b5388e33af4a4cbcec8c/benchmarks
 */

import {QuadStore} from '../lib/quadstore';
import {TSSearchStageType, TSBinding} from '../lib/types';
import {disk, time} from './utils';
import {waitForEvent} from '../lib/utils';

const qty = 10000;

const doWrites = async (store: QuadStore) => {
  const vertexes = ["a", "b"];
  for (let i = 0; i < qty; i += 1) {
    vertexes.pop();
    vertexes.unshift("v" + i);
    await store.put({
      subject: vertexes[0],
      predicate: "p",
      object: vertexes[1],
      graph: "g",
    });
  }
};

const doReads = async (store: QuadStore) => {
  let count = 0;
  const results = await store.searchStream([
    { type: TSSearchStageType.BGP, pattern: { subject: '?a', predicate: 'p', object: '?b' } },
    { type: TSSearchStageType.BGP, pattern: { subject: '?b', predicate: 'p', object: '?c' } },
  ]);
  results.iterator.on('data', () => {
    count++;
  });
  await waitForEvent(results.iterator, 'end');
  return count;
};


disk(async (backend, checkDiskUsage) => {
  const store = new QuadStore({ backend });
  await doWrites(store);
  console.log('written to disk');
  const { time: readTime, value: readQty } = await time(() => doReads(store));
  const diskUsage = await checkDiskUsage();
  console.log('total time', readTime);
  console.log('total data', readQty);
  console.log('join result/s', readQty / readTime * 1000);
  console.log('disk usage', diskUsage);
});

