
'use strict';

function toArray(readable, cb) {
  const items = [];
  readable
    .on('data', (item) => { items.push(item); })
    .on('end', () => { cb(null, items); });
}

module.exports.toArray = toArray;

function flattenQuad(q) {
  return q.subject + '::' + q.predicate + '::' + q.object + '::' + q.context;
}

function quadSorter(a, b) {
  const flattenedA = flattenQuad(a);
  const flattenedB = flattenQuad(b);
  if (flattenedA === flattenedB) return 0;
  if (flattenedA < flattenedB) return 1;
  return -1;
}

module.exports.quadSorter = quadSorter;
