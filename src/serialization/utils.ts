
export const copyBufferIntoBuffer = (source: Buffer, target: Buffer, targetFrom: number) => {
  source.copy(target, targetFrom,  0, source.byteLength);
};

export const sliceBuffer = (source: Buffer, offset: number, length: number): Buffer => {
  return source.subarray(offset, offset + length);
};

export const sliceString = (source: string, offset: number, length: number): string => {
  return source.slice(offset, offset + length);
};

export const copyBuffer = (source: Buffer, offset: number, length: number): Buffer => {
  return Buffer.from(source.subarray(offset, offset + length));
};
