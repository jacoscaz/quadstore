"use strict";
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
    if (typeof (n) !== 'number') {
        n = parseFloat(n);
    }
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
            return joinParts(1, flipExponent(exponentChars), flipMantissa(mantissaChars));
        case '--':
            return joinParts(2, exponentChars, flipMantissa(mantissaChars));
        case '-+':
            return joinParts(4, flipExponent(exponentChars), mantissaChars);
        case '++':
            return joinParts(5, exponentChars, mantissaChars);
        default:
            throw new Error('should not be here');
    }
};
module.exports = encode;
//# sourceMappingURL=fpstring.js.map