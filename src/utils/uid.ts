
/**
 * Port of Hexoid
 * https://github.com/lukeed/hexoid/commit/029de61ca54d58c47d34a08f4e35a55e0f9c807f
 * Released under the MIT license by Luke Edwards (@lukeed)
 * https://lukeed.com/
 */

let IDX: number = 256;
const HEX: string[] = [];

while (IDX--) {
  HEX[IDX] = (IDX + 256).toString(16).substring(1);
}

export const createUid = (len: number): () => string => {
  len = len || 16;
  let str: string = '';
  let num: number = 0;
  return () => {
    if (!str || num === 256) {
      str = '';
      num = (1 + len) / 2 | 0;
      while (num--) {
        str += HEX[256 * Math.random() | 0];
      }
      str = str.substring(num = 0, len - 2);
    }
    return str + HEX[num++];
  };
};

export const uid = createUid(11);
