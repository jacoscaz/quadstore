
export const sliceValueBuffer = (source: DataView, offset: number, length: number): DataView => {
  return new DataView(source.buffer, source.byteOffset + offset, Math.min(source.byteLength, length));
};

export const copyValueBuffer = (source: DataView, offset: number, length: number): DataView => {
  const sliceOffset = source.byteOffset + offset;
  return new DataView(source.buffer.slice(sliceOffset, sliceOffset + Math.min(source.byteLength, length)));
};

export const UInt8ArrayToValueBuffer = (arr: Uint8Array): DataView => {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
};

export const ValueBufferToUInt8Array = (buf: DataView): Uint8Array => {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
};

export const sliceString = (source: string, offset: number, length: number): string => {
  return source.slice(offset, offset + length);
};


