
const _ = require('../../lib/utils/lodash');
const should = require('should');
const factory = require('@rdfjs/data-model');

module.exports = () => {
  describe('INSERT DATA', () => {

    it('should insert a single quad', async function () {
      await this.store.sparql(`
        INSERT DATA { GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . <ex://s4> <ex://p4> <ex://o4> . } 
      `);
      const quads = await this.store.get({graph: factory.namedNode('ex://g3')});
      should(quads.length).equal(1);
    });

  });
};
