
module.exports = () => {
  describe('Search', () => {
    require('./search.sortiterator')();
    require('./search.mergeiterator')();
    require('./search.nestedloopjoiniterator')();
  });
};
