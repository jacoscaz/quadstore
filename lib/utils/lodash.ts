
export const isFunction = (f: any): boolean => {
  return typeof(f) === 'function';
};

export const isObject = (o: any): boolean => {
  return typeof(o) === 'object' && o !== null;
};

export const isSimpleObject = (o: any): boolean => {
  return isObject(o) && o.constructor === Object;
};

export const isString = (s: any): boolean => {
  return typeof(s) === 'string';
};

export const isNil = (n: any): boolean => {
  return n === null || n === undefined;
};

export const isArray = Array.isArray;
