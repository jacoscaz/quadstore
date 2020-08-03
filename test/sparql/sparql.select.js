
module.exports = () => {
  describe('SELECT', () => {
    require('./sparql.select.simple')();
    require('./sparql.select.graphs')();
    require('./sparql.select.literals')();
  });
};
