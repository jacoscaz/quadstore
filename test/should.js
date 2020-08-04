
const should = require('should');

const equalToQuadArray = function (expected, store, message) {
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
  const comparator = store.getQuadComparator();
  const sortedActual = actual.slice();
  sortedActual.sort(comparator);
  const sortedExpected = actual.slice();
  sortedExpected.sort(comparator);
  for (let i = 0; i < sortedExpected.length; i += 1) {
    should(comparator(sortedActual[i], sortedExpected[i])).eql(0);
  }
};

should.Assertion.add('equalToQuadArray', equalToQuadArray, false);

module.exports = should;
