
const should = require('should');

const equalToItemArray = function (expected, comparator, message) {
  this.params = {
    message,
    expected,
    operator: 'to be',
    showDiff: true,
  };
  const actual = this.obj;
  should(expected).be.an.Array();
  should(actual).be.an.Array();
  should(expected.length).eql(actual.length);
  const sortedActual = actual.slice();
  sortedActual.sort(comparator);
  const sortedExpected = actual.slice();
  sortedExpected.sort(comparator);
  for (let i = 0; i < sortedExpected.length; i += 1) {
    should(comparator(sortedActual[i], sortedExpected[i])).eql(0);
  }
};


const equalToQuadArray = function (expected, store, message) {
  return equalToItemArray.call(this, expected, store.getQuadComparator(), message);
};

should.Assertion.add('equalToQuadArray', equalToQuadArray, false);

const equalToBindingArray = function (expected, store, variables, message) {
  return equalToItemArray.call(this, expected, store.getBindingComparator(variables), message);
};

should.Assertion.add('equalToBindingArray', equalToBindingArray, false);

module.exports = should;
