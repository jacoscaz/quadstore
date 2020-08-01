
/*
 * flatmap-fast v3.0.0 by ryanpcmcquen
 * https://github.com/ryanpcmcquen/flatmap-fast/
 * https://github.com/ryanpcmcquen/flatmap-fast/commit/f69dfb603f6ba955c0742934302a0c99c95c5133
 * LICENSE: MPL
 */

const flatten = <T>(arr: T[][]): T[] => {
  return arr.reduce((acc, item) => {
    return acc.concat(item);
  });
};

export const flatMap = <T, Q>(arr: T[], mapFn: (o: T) => Q[]): Q[] => {
  if (arr.length < 1) return [];
  return flatten(arr.map(mapFn));
};
