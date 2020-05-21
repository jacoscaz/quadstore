
const _ = require('../../lib/utils/lodash');
const should = require('should');
const factory = require('@rdfjs/data-model');

module.exports = () => {
  describe('DELETE DATA', () => {

    it('should insert a single quad', async function () {
      await this.store.sparql(`
        INSERT DATA { 
          GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . 
          GRAPH <ex://g4> { <ex://s4> <ex://p4> <ex://o4>. } .
        } 
      `);
      should(await this.store.get({})).have.length(2);
      await this.store.sparql(`
        DELETE DATA { 
          GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } .
        } 
      `);
      should(await this.store.get({})).have.length(1);
    });

  });
};
