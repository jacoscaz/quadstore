
'use strict';

function flattenQuad(q) {
  return q.subject + '::' + q.predicate + '::' + q.object + '::' + q.context;
}

function quadSorter(a, b) {
  const flattenedA = flattenQuad(a);
  const flattenedB = flattenQuad(b);
  if (flattenedA === flattenedB) {
    return 0;
  } else if (flattenedA < flattenedB) {
    return 1;
  } else {
    return -1;
  }
}

module.exports.quadSorter = quadSorter;
