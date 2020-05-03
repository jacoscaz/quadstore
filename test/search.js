
module.exports = () => {
  describe('search', () => {
    require('./search.sortiterator')();
    require('./search.mergeiterator')();
    require('./search.nestedloopjoiniterator')();
  });
};
