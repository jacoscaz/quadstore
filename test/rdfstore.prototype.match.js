
'use strict';

const _ = require('../lib/utils/lodash');
const utils = require('../lib/utils');
const should = require('should');
const factory = require('@rdfjs/data-model');
const AsyncIterator = require('asynciterator');

function stripTermSerializedValue(quads) {
  const _quads = _.isArray(quads) ? quads : [quads];
  quads.forEach((quad) => {
    ['subject', 'predicate', 'object', 'graph'].forEach((termKey) => {
      delete quad[termKey]._serializedValue;
    });
  });
  return _.isArray(quads) ? _quads : _quads[0];
}

module.exports = () => {

  describe('RdfStore.prototype.match()', () => {

    describe('Match by value', () => {

      it('should match quads by subject', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const subject = factory.namedNode('http://ex.com/s2');
        const matchedQuads = await utils.streamToArray(rs.match(subject));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match quads by predicate',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p2'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const predicate = factory.namedNode('http://ex.com/p2');
        const matchedQuads = await utils.streamToArray(rs.match(null, predicate));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match quads by object',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g2')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o2', 'en-gb'),
            factory.namedNode('http://ex.com/g2')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const object = factory.literal('o2', 'en-gb');
        const matchedQuads = await utils.streamToArray(rs.match(null, null, object));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match quads by graph',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('o', 'en-gb'),
            factory.namedNode('http://ex.com/g2')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const graph = factory.namedNode('http://ex.com/g2');
        const matchedQuads = await utils.streamToArray(rs.match(null, null, null, graph));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should match the default graph (explicit)',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb'),
            factory.defaultGraph()
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const matchedQuads = await utils.streamToArray(rs.match(null, null, null, factory.defaultGraph()));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[0]);
      });

      it('should match quads by the default graph (implicit)',  async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s0'),
            factory.namedNode('http://ex.com/p0'),
            factory.literal('o0', 'en-gb')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s1'),
            factory.namedNode('http://ex.com/p1'),
            factory.literal('o1', 'en-gb'),
            factory.namedNode('http://ex.com/g1')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const readStream = rs.match(null, null, null, factory.defaultGraph());
        const matchedQuads = await utils.streamToArray(readStream);
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0].graph).deepEqual(quads[0].graph);
      });

    });

    describe('Match by range', () => {

      it('should match quads by object (literal) [GT]', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('"5"', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('"7"', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        // console.log(await store._debugQuads());
        const match = { gt: factory.literal('"6"', 'http://www.w3.org/2001/XMLSchema#integer') };
        const matchedQuads = await utils.streamToArray(rs.match(null, null, match, null));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });
      it('should match quads by object (literal) [GTE]', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('"5"', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('"7"', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const match = { gte: factory.literal('"7.0"', 'http://www.w3.org/2001/XMLSchema#double') };
        const matchedQuads = await utils.streamToArray(rs.match(null, null, match, null));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(1);
        should(matchedQuads[0]).deepEqual(quads[1]);
      });

      it('should not match quads by object (literal) if out of range [GT]', async function () {
        const store = this.store;
        const rs = store;
        const quads = [
          factory.quad(
            factory.namedNode('http://ex.com/s'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('"5"', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          ),
          factory.quad(
            factory.namedNode('http://ex.com/s2'),
            factory.namedNode('http://ex.com/p'),
            factory.literal('"7"', 'http://www.w3.org/2001/XMLSchema#integer'),
            factory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await utils.waitForEvent(store.import(source), 'end', true);
        const match = {
          gt: factory.literal('"7.0"', 'http://www.w3.org/2001/XMLSchema#double'),
        };
        const matchedQuads = await utils.streamToArray(rs.match(null, null, match, null));
        stripTermSerializedValue(matchedQuads);
        should(matchedQuads).have.length(0);
      });
    });

  });

};
