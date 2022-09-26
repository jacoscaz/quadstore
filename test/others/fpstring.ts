
import { toStrictlyEqual } from '../utils/expect';
import { encode } from '../../dist/esm/serialization/fpstring';

export const runFpstringTests = () => {

  describe('Floating-point serialization', () => {

    it('should produce strings whose lexicographical sorting matches the natural sorting of the original values', async () => {

      const values = [
        -123123,
        -123.123,
        -9.1,
        -9,
        -2.123,
        -1.23,
        -1,
        -0.2123
        -0.123,
        -0.1,
        0,
        0.1,
        0.123,
        0.2123,
        1,
        1.23,
        2.123,
        9,
        9.1,
        123.123,
        123123,
      ];

      const shuffled = [
        0,
        123.123,
        -123.123,
        0.2123,
        -9.1,
        -1,
        0.123,
        9,
        -0.3353,
        123123,
        -123123,
        -1.23,
        -0.1,
        2.123,
        -9,
        -2.123,
        9.1,
        0.1,
        1,
        1.23
      ];

      const pairs: [number, string][] = shuffled.map(n => [n, encode(n)]);
      pairs.sort((p1, p2) => p1[1] < p2[1] ? -1 : 1);

      pairs.forEach((p, i) => {
        toStrictlyEqual(p[0], values[i]);
      });

    });

  });

};
