
export const sliceString = (source: string, offset: number, length: number): string => {
  return source.slice(offset, offset + length);
};

export const padNumStart = (val: number) => {
  if (val < 36) return `000${val.toString(36)}`;
  if (val < 1_296) return `00${val.toString(36)}`;
  if (val < 46_656) return `0${val.toString(36)}`;
  if (val < 1_679_615) return val.toString(36);
  throw new Error('too long: ' + val);
};
