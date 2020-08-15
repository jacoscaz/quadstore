
module.exports = () => {

  describe('QuadStore.prototype.search()', () => {
    require('./quadstore.prototype.search.simple')();
    require('./quadstore.prototype.search.filters')();
    require('./quadstore.prototype.search.construct')();
  });
  
};
