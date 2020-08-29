/*
 * This benchmark was ported from LevelGraph's searchStream.js benchmark
 * https://github.com/levelgraph/levelgraph/tree/d918ff445e78e22410b4b5388e33af4a4cbcec8c/benchmarks
 */

import memdown from 'memdown';
import {QuadStore} from '../lib/quadstore';
import {TSSearchStageType, TSBinding} from '../lib/types';

const store = new QuadStore({
  backend: memdown(),
});

const startCounts = 100000;
let counts = startCounts;

let startTime: number;
let endTime: number;

const vertexes = ["a", "b"];

const doReads = async () => {

  const results = await store.searchStream([
    { type: TSSearchStageType.BGP, pattern: { subject: '?a', predicate: 'p', object: '?b' } },
    { type: TSSearchStageType.BGP, pattern: { subject: '?b', predicate: 'p', object: '?c' } },
  ]);

  // @ts-ignore
  results.iterator.on('data', (binding: TSBinding) => {
    counts++;
  });

  results.iterator.on("end", () => {
    endTime = Date.now();
    const totalTime = endTime - startTime;
    console.log("total time", totalTime);
    console.log("total data", counts);
    console.log("join result/s", counts / totalTime * 1000);
  });

};

const doWrites = async () => {

  if(--counts === 0) {
    startTime = Date.now();
    await doReads();
    return;
  }

  const quad = {
    subject: vertexes[0],
    predicate: "p",
    object: vertexes[1],
    graph: "g",
  };

  vertexes.pop();
  vertexes.unshift("v" + counts);

  await store.put(quad);
  await doWrites();

}

doWrites();
