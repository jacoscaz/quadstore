
module.exports = () => {
  describe('SELECT', () => {
    require('./sparql.select.simple')();
    require('./sparql.select.graphs')();
    require('./sparql.select.filters')();
    require('./sparql.select.literals')();
    require('./sparql.select.offsetlimit')();
    require('./sparql.select.join')();
  });
};
