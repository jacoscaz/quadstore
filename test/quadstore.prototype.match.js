
'use strict';

const should = require('should');
const AsyncIterator = require('asynciterator');
const { DefaultGraphMode } = require('../dist/cjs/types');
const { waitForEvent, streamToArray } = require('../dist/cjs/utils/stuff');

module.exports = () => {

  describe('Quadstore.prototype.match()', () => {

    describe('Match by value', () => {

      it('should match quads by subject', async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s2'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const subject = dataFactory.namedNode('http://ex.com/s2');
        const matchedQuads = await streamToArray(store.match(subject));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[1]]);
      });

      it('should match quads by predicate',  async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p2'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const predicate = dataFactory.namedNode('http://ex.com/p2');
        const matchedQuads = await streamToArray(store.match(null, predicate));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[1]]);
      });

      it('should match quads by object',  async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g2')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o2', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g2')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const object = dataFactory.literal('o2', 'en-gb');
        const matchedQuads = await streamToArray(store.match(null, null, object));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[1]]);
      });

      it('should match quads by graph',  async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('o', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g2')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const graph = dataFactory.namedNode('http://ex.com/g2');
        const matchedQuads = await streamToArray(store.match(null, null, null, graph));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[1]]);
      });

      it('should match the default graph when explicitly passed',  async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s0'),
            dataFactory.namedNode('http://ex.com/p0'),
            dataFactory.literal('o0', 'en-gb'),
            dataFactory.defaultGraph()
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s1'),
            dataFactory.namedNode('http://ex.com/p1'),
            dataFactory.literal('o1', 'en-gb'),
            dataFactory.namedNode('http://ex.com/g1')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const matchedQuads = await streamToArray(store.match(null, null, null, dataFactory.defaultGraph()));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[0]]);
      });

    });

    describe('Match by range', () => {

      it('should match quads by object (literal) [GT]', async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('5', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            dataFactory.namedNode('http://ex.com/g')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s2'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('7', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            dataFactory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const match = { termType: 'Range',
          gt: dataFactory.literal('6', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')) };
        const matchedQuads = await streamToArray(store.match(null, null, match, null));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[1]]);
      });

      it('should match quads by object (literal) [GTE]', async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('5', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            dataFactory.namedNode('http://ex.com/g')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s2'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('7', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            dataFactory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const match = { termType: 'Range',
          gte: dataFactory.literal('7.0', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double')) };
        const matchedQuads = await streamToArray(store.match(null, null, match, null));
        should(matchedQuads).have.length(1);
        should([matchedQuads[0]]).be.equalToQuadArray([quads[1]]);
      });

      it('should not match quads by object (literal) if out of range [GT]', async function () {
        const { dataFactory, store } = this;
        const quads = [
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('5', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            dataFactory.namedNode('http://ex.com/g')
          ),
          dataFactory.quad(
            dataFactory.namedNode('http://ex.com/s2'),
            dataFactory.namedNode('http://ex.com/p'),
            dataFactory.literal('7', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
            dataFactory.namedNode('http://ex.com/g')
          )
        ];
        const source = new AsyncIterator.ArrayIterator(quads);
        await waitForEvent(store.import(source), 'end', true);
        const match = {
          termType: 'Range',
          gt: dataFactory.literal('7.0', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double')),
        };
        const matchedQuads = await streamToArray(store.match(null, null, match, null));
        should(matchedQuads).have.length(0);
      });
    });

  });

};
