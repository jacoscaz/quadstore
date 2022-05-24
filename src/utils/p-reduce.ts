
/*
 * This is a Typescript version of the `p-reduce` package. Most of the credit
 * goes to the great Sindre Sorhus. This just repackages the actual .js code
 * and the .d.ts type declarations into a single file with a slight change that
 * forces the use of the `initialValue` parameter.
 *
 * Repo: https://github.com/sindresorhus/p-reduce
 * Commit: https://github.com/sindresorhus/p-reduce/blob/484c6f2868fdff3ce5a7dc145d5dee02957d4b63/index.js
 * License: MIT
 */
'use strict';

type ReducerFunction<ValueType, ReducedValueType = ValueType> = (
  previousValue: ReducedValueType,
  currentValue: ValueType,
  index: number
) => PromiseLike<ReducedValueType> | ReducedValueType;

export const pReduce = <ValueType, ReducedValueType = ValueType>(
	iterable: Iterable<PromiseLike<ValueType> | ValueType>,
	reducer: ReducerFunction<ValueType, ReducedValueType>,
	initialValue: ReducedValueType
): Promise<ReducedValueType> => {
  return new Promise((resolve, reject) => {
    const iterator = iterable[Symbol.iterator]();
    let index = 0;
    const next = async (total: PromiseLike<ReducedValueType> | ReducedValueType) => {
      const element = iterator.next();
      if (element.done) {
        resolve(total);
        return;
      }
      try {
        const value = await Promise.all([total, element.value]);
        next(reducer(value[0], value[1], index++));
      } catch (error) {
        reject(error);
      }
    };
    next(initialValue);
  });
};
