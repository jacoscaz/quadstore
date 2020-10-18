
'use strict';

module.exports = () => {

  describe('RdfStore.prototype.sparql()', () => {
    require('./sparql/sparql.select')();
    require('./sparql/sparql.update')();
    require('./sparql/sparql.construct')();
  });

}
