
const _ = require('../../dist/lib/utils');
const should = require('should');

module.exports = () => {
  describe('INSERT DATA', () => {

    it('should insert a single quad in the default graph', async function () {
      const { dataFactory, store } = this;
      await store.sparql(`
        INSERT DATA { <ex://s4> <ex://p4> <ex://o4> . } 
      `);
      const { items } = await store.get({});
      should(items.length).equal(1);
      should(items[0].subject.equals(dataFactory.namedNode('ex://s4')));
      should(items[0].predicate.equals(dataFactory.namedNode('ex://p4')));
      should(items[0].object.equals(dataFactory.namedNode('ex://o4')));
      should(items[0].graph.equals(dataFactory.defaultGraph()));
    });

    it('should insert a single quad in a custom graph', async function () {
      const { dataFactory, store } = this;
      await store.sparql(`
        INSERT DATA { GRAPH <ex://g4> { <ex://s4> <ex://p4> <ex://o4> . } . } 
      `);
      const { items } = await store.get({});
      should(items.length).equal(1);
      should(items[0].subject.equals(dataFactory.namedNode('ex://s4')));
      should(items[0].predicate.equals(dataFactory.namedNode('ex://p4')));
      should(items[0].object.equals(dataFactory.namedNode('ex://o4')));
      should(items[0].graph.equals(dataFactory.namedNode('ex://g4')));
    });

    it('should insert multiple quads in the default graph', async function () {
      const { dataFactory, store } = this;
      await store.sparql(`
        INSERT DATA {
          <ex://s3> <ex://p3> <ex://o3> .
          <ex://s4> <ex://p4> <ex://o4> . 
        }  
      `);
      const { items } = await store.get({});
      should(items.length).equal(2);
      should(items[0].subject.equals(dataFactory.namedNode('ex://s3')));
      should(items[0].predicate.equals(dataFactory.namedNode('ex://p3')));
      should(items[0].object.equals(dataFactory.namedNode('ex://o3')));
      should(items[0].graph.equals(dataFactory.defaultGraph()));
      should(items[1].subject.equals(dataFactory.namedNode('ex://s4')));
      should(items[1].predicate.equals(dataFactory.namedNode('ex://p4')));
      should(items[1].object.equals(dataFactory.namedNode('ex://o4')));
      should(items[1].graph.equals(dataFactory.defaultGraph()));
    });

    it('should insert multiple quads in a custom graph', async function () {
      const { dataFactory, store } = this;
      await store.sparql(`
        INSERT DATA {
          GRAPH <ex://g3> { 
            <ex://s3> <ex://p3> <ex://o3> .
            <ex://s4> <ex://p4> <ex://o4> .
          } . 
        }  
      `);
      const { items } = await store.get({});
      should(items.length).equal(2);
      should(items[0].subject.equals(dataFactory.namedNode('ex://s3')));
      should(items[0].predicate.equals(dataFactory.namedNode('ex://p3')));
      should(items[0].object.equals(dataFactory.namedNode('ex://o3')));
      should(items[0].graph.equals(dataFactory.namedNode('ex://g3')));
      should(items[1].subject.equals(dataFactory.namedNode('ex://s4')));
      should(items[1].predicate.equals(dataFactory.namedNode('ex://p4')));
      should(items[1].object.equals(dataFactory.namedNode('ex://o4')));
      should(items[1].graph.equals(dataFactory.namedNode('ex://g3')));
    });

  });
};
