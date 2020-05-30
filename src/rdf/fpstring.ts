
/*
 * License: MIT
 * Author: Jacopo Scazzosi <jacopo@beautifulinteractions.com>
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
 * The only deviation from Doug's draft consists in flipping the
 * exponent's digits by subtracting the exponent from 999 and flipping
 * the mantissa's digits by subtracting the mantissa from 10.
 *
 * FLIPPED_EXPONENT = 999 - EXPONENT
 * FLIPPED_MANTISSA =  10 - MANTISSA
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
 * have been flipped:
 *
 * 1. Negative mantissa and positive exponent ==> FLIP BOTH
 * 2. Negative mantissa and negative exponent ==> FLIP MANTISSA
 * 3. Zero                                    ==> RETURN ZERO
 * 4. Positive mantissa and negative exponent ==> FLIP EXPONENT
 * 5. Positive mantissa and positive exponent ==> NOTHING TO FLIP
 */

const joinParts = (encodingCase, exponentChars, mantissaChars) => {
  return `${encodingCase}${exponentChars}${mantissaChars.charAt(0)}${mantissaChars.slice(2)}`;
};

const flipExponent = (exponentChars) => {
  return (999 - parseInt(exponentChars)).toString().padStart(3, '0');
};

const flipMantissa = (mantissaChars) => {
  return (10 - parseFloat(mantissaChars)).toPrecision(17).slice(0, 18);
};

const encode = (n) => {

  if (typeof(n) !== 'number') {
    n = parseFloat(n);
  }

  // CASE 3: n === 0
  if (n === 0) {
    return joinParts(3, '000', '0.0000000000000000');
  }

  const e = (n > 0 ? '+' : '') + n.toExponential(16);

  const mantissaSign = e.charAt(0);
  const mantissaChars = e.slice(1, 19);

  const exponentSign = e.charAt(20);
  const exponentChars = e.slice(21).padStart(3, '0');

  switch (`${exponentSign}${mantissaSign}`) {
    case '+-':
      // CASE 1: n <= -1
      return joinParts(1, flipExponent(exponentChars), flipMantissa(mantissaChars));
    case '--':
      // CASE 2: -1 < n < 0
      return joinParts(2, exponentChars, flipMantissa(mantissaChars));
    case '-+':
      // CASE 4: 0 < n < 1
      return joinParts(4, flipExponent(exponentChars), mantissaChars);
    case '++':
      // CASE 5: n >= 1
      return joinParts(5, exponentChars, mantissaChars);
    default:
      throw new Error('should not be here');
  }

};

module.exports = encode;
