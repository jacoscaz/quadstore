
'use strict';

const _ = require('../lib/utils/lodash');
const should = require('should');
const factory = require('@rdfjs/data-model');
const utils = require('../lib/utils');

module.exports = () => {

  describe('RdfStore.prototype.sparql()', () => {

    describe('SELECT', () => {

      beforeEach(async function () {
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.namedNode('http://ex.com/o'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p2'),
            factory.namedNode('http://ex.com/o2'),
            factory.namedNode('http://ex.com/g2')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.namedNode('http://ex.com/o'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.namedNode('http://ex.com/o2'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p2'),
            factory.namedNode('http://ex.com/o2'),
            factory.namedNode('http://ex.com/g2')
          ),
        ];
        await this.store.put(quads);
      });

    });
    // it('should do stuff', async function () {
    //   const iterator = this.store.sparqlStream(`
    //     SELECT * { ?s <http://ex.com/p> <http://ex.com/o>. }
    //   `);
    //   const results = await utils.streamToArray(iterator);
    //   console.log(results);
    // });
    //
    // it('should do stuff 2', async function () {
    //   const iterator = this.store.sparqlStream(`
    //     SELECT ?s ?o {
    //       ?s <http://ex.com/p> <http://ex.com/o>.
    //       ?s <http://ex.com/p2> ?o.
    //     }
    //   `);
    //   const results = await utils.streamToArray(iterator);
    //   console.log(results);
    // });

    describe('INSERT DATA', () => {

      it('should insert a single quad', async function () {
        await this.store.sparql(`
          INSERT DATA { GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . <ex://s4> <ex://p4> <ex://o4> . } 
        `);
        const quads = await this.store.get({ graph: factory.namedNode('ex://g3') });
        should(quads.length).equal(1);
      });

    });

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

    describe('INSERT / DELETE', () => {

      it('should delete a quad and insert a new quad', async function () {
        await this.store.sparql(`
          INSERT DATA { 
            GRAPH <ex://g3> { <ex://s3> <ex://p3> <ex://o3>. } . 
            GRAPH <ex://g4> { <ex://s4> <ex://p4> <ex://o4>. } .
          } 
        `);
        should(await this.store.get({})).have.length(2);
        await this.store.sparql(`
          DELETE { GRAPH ?g { ?s <ex://p3> <ex://o3> } }
          INSERT { GRAPH <ex://g5> { ?s <ex://p5> <ex://o5> } }
          WHERE  { GRAPH ?g { ?s <ex://p3> <ex://o3> } }
        `);
        const quads = await this.store.get({});
        should(quads).have.length(2);
      });

    });



  });

}
