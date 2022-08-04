
export const sliceString = (source: string, offset: number, length: number): string => {
  return source.slice(offset, offset + length);
};

export const viewUint8ArrayAsUint16Array = (source: Uint8Array): Uint16Array => {
  return new Uint16Array(source.buffer, source.byteOffset, source.byteLength / 2);
};

export const viewUint16ArrayAsUint8Array = (source: Uint16Array, offset: number, length: number): Uint8Array => {
  return new Uint8Array(source.buffer, source.byteOffset + offset * 2, length * 2);
};
