
export const sliceString = (source: string, offset: number, length: number): string => {
  return source.slice(offset, offset + length);
};

export const copyUint16ArrayToUint8Array = (source: Uint16Array, length: number): Uint8Array => {
  // return new Uint8Array(source.buffer, source.byteOffset, source.byteOffset + length * 2));
  return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + length * 2));
};

export const viewUint8ArrayAsUint16Array = (source: Uint8Array): Uint16Array => {
  return new Uint16Array(source.buffer, source.byteOffset, source.byteLength / 2);
};

export const viewUint16ArrayAsUint8Array = (source: Uint16Array, length: number): Uint8Array => {
  return new Uint8Array(source.buffer, source.byteOffset, Math.max(length * 2, source.byteLength));
};


