
export const sliceString = (source: string, offset: number, length: number): string => {
  return source.slice(offset, offset + length);
};

export const LENGTH_OF_ENCODED_TERM_LENGTH = 4;

export const encodeTermLength = (val: number) => {
  if (val < 36) return `000${val.toString(36)}`;
  if (val < 1_296) return `00${val.toString(36)}`;
  if (val < 46_656) return `0${val.toString(36)}`;
  if (val < 1_679_616) return val.toString(36);
  throw new Error('term serialization exceeded maximum limit of 1_679_616 characters');
};

export const decodeTermLength = (str: string) => {
  return parseInt(str, 36);
};

export const LENGTH_OF_ENCODED_QUAD_LENGTH = 5;

export const encodeQuadLength = (val: number) => {
  if (val < 36) return `0000${val.toString(36)}`;
  if (val < 1_296) return `000${val.toString(36)}`;
  if (val < 46_656) return `00${val.toString(36)}`;
  if (val < 1_679_616) return `0${val.toString(36)}`;
  if (val < 60_466_176) return val.toString(36);
  throw new Error('quad serialization exceeded maximum limit of 60_466_176 characters');
};

export const decodeQuadLength = (str: string) => {
  return parseInt(str, 36);
};
