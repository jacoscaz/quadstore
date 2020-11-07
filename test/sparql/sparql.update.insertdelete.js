
const _ = require('../../dist/lib/utils');
const should = require('should');

module.exports = () => {

  describe('INSERT / DELETE', () => {

    it('should delete a quad and insert a new quad', async function () {
      const { store } = this;
      await store.sparql(`
        INSERT DATA { 
          GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . 
          GRAPH <ex://g4> { <ex://s4> <ex://p4> <ex://o4>. } .
        } 
      `);
      const first = await store.get({});
      should(first.items).have.length(2);
      await store.sparql(`
        DELETE { GRAPH ?g { ?s <ex://p3> <ex://o3> } }
        INSERT { GRAPH <ex://g5> { ?s <ex://p5> <ex://o5> } }
        WHERE  { GRAPH ?g { ?s <ex://p3> <ex://o3> } }
      `);
      const second = await store.get({});
      should(second.items).have.length(2);
    });

    it('should insert a new quad', async function () {
      const { store } = this;
      await store.sparql(`
        INSERT DATA { 
          GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . 
          GRAPH <ex://g4> { <ex://s4> <ex://p4> <ex://o4>. } .
        } 
      `);
      const first = await store.get({});
      should(first.items).have.length(2);
      await store.sparql(`
        INSERT { GRAPH <ex://g5> { ?s <ex://p5> <ex://o5> } }
        WHERE  { GRAPH ?g { ?s <ex://p3> <ex://o3> } }
      `);
      const second = await store.get({});
      should(second.items).have.length(3);
    });

  });
};
