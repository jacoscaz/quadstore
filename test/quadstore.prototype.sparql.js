
'use strict';

module.exports = () => {

  describe('Quadstore.prototype.sparql()', () => {
    require('./sparql/sparql.select')();
    require('./sparql/sparql.update')();
    require('./sparql/sparql.construct')();
    require('./sparql/sparql.describe')();
  });

}
