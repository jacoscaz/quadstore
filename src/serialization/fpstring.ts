
/*
 * License: MIT
 * Author: Jacopo Scazzosi <jacopo@scazzosi.com>
 *
 * The content of this file is an implementation of an encoding
 * technique for floating point numbers. Given a set of floating
 * point values, their encoded strings are such that their
 * lexicographical ordering follows the numerical ordering of the
 * original values.
 *
 * The specific encoding technique is based on the internet draft
 * "Directory string representation for floating point values" by
 * Doug Wood of Tivoli Systems Inc., submitted in Dec, 1999.
 *
 * https://tools.ietf.org/html/draft-wood-ldapext-float-00
 *
 * The resulting strings follow the pattern described in the draft:
 *
 * +-+-+---+-+------------------+
 * | | |Exp| | Mantissa         |
 * +-+-+---+-+------------------+
 * |c| |nnn| |n.nnnnnnnnnnnnnnnn|
 * +-+-+---+-+------------------+
 *
 * The first character identifies which case the original number
 * belongs to, which determines whether the exponent and mantissa
 * have been flipped and/or inverted:
 *
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | CASE | RANGE      | MANTISSA AND EXPONENT SIGNS             | FLIPS              | INVERSIONS |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 0    | -Infinity  |                                         |                    |            |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 1    | X <= -1    | negative mantissa and positive exponent | mantissa, exponent |            |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 2    | 0 < X < -1 | negative mantissa and negative exponent | mantissa           | exponent   |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 3    | X = 0      |                                         |                    |            |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 4    | 0 < X < 1  | positive mantissa and negative exponent | exponent           | exponent   |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 5    | X >= 1     | positive mantissa and positive exponent | mantissa, exponent |            |
 * +------+------------+-----------------------------------------+--------------------+------------+
 * | 6    | Infinity   |                                         |                    |            |
 * +------+------------+-----------------------------------------+--------------------+------------+
 *
 */


const join = (encodingCase: number, exponent: number, mantissa: number): string => {
  let r = '' + encodingCase;
  if (exponent < 10) {
    r += '00' + exponent;
  } else if (exponent < 100) {
    r += '0' + exponent;
  } else {
    r += exponent;
  }
  r += mantissa.toFixed(17);
  return r;
};

const ZERO = join(3, 0, 0);
const NEG_INF = join(0, 0, 0);
const POS_INF = join(6, 0, 0);

export const encode = (stringOrNumber: string|number): string => {

  let mantissa: number = typeof stringOrNumber !== 'number'
    ? parseFloat(stringOrNumber)
    : stringOrNumber;

  if (Number.isNaN(mantissa)) {
    throw new Error(`Cannot serialize NaN`);
  }

  if (mantissa === -Infinity) {
    return NEG_INF;
  }

  if (mantissa === Infinity) {
    return POS_INF;
  }

  if (mantissa === 0) {
    return ZERO;
  }

  let exponent = 0
  let sign = 0

  if (mantissa < 0) {
    sign = 1;
    mantissa *= -1;
  }

  while (mantissa > 10) {
    mantissa /= 10;
    exponent += 1;
  }

  while (mantissa < 1) {
    mantissa *= 10;
    exponent -= 1;
  }

  if (sign === 1) {
    if (exponent >= 0) {
      return join(1, 999 - exponent, 10 - mantissa);
    } else {
      return join(2, exponent * -1, 10 - mantissa);
    }
  } else {
    if (exponent < 0) {
      return join(4, 999 + exponent, mantissa);
    } else {
      return join(5, exponent, mantissa);
    }
  }

};
