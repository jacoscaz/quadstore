
const _ = require('../../dist/lib/utils');
const should = require('should');

module.exports = () => {
  describe('DELETE DATA', () => {

    it('should delete a single quad', async function () {
      await this.store.sparql(`
        INSERT DATA { 
          GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . 
          GRAPH <ex://g4> { <ex://s4> <ex://p4> <ex://o4>. } .
        } 
      `);
      const first = await this.store.get({});
      should(first.items).have.length(2);
      await this.store.sparql(`
        DELETE DATA { 
          GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } .
        } 
      `);
      const second = await this.store.get({});
      should(second.items).have.length(1);
    });

  });
};
