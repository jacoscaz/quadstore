
import type {Quad, Term} from '@rdfjs/types';
import { ArrayIterator } from 'asynciterator';
import { streamToArray } from '../../dist/esm/utils/stuff';
import { Scope } from '../../dist/esm/scope';
import { LevelIterator } from '../../dist/esm/get/leveliterator';
import { arrayToHaveLength, equalsQuadArray, toBeAnArray, toBeFalse, toStrictlyEqual, toBeTrue } from '../utils/expect';

export const runPutTests = () => {

  describe('Quadstore.prototype.put()', () => {

    it('should store a single quad', async function () {
      const { dataFactory, store } = this;
      const newQuad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.namedNode('ex://o'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(newQuad);
      const {items: foundQuads} = await store.get({});
      equalsQuadArray(foundQuads, [newQuad]);
    });

    it('should store a single quad with a term that serializes to a string longer than 127 chars', async function () {
      const { dataFactory, store } = this;
      const newQuad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.literal(''.padStart(129, 'aaabbb')),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(newQuad);
      const {items: foundQuads} = await store.get({});
      equalsQuadArray(foundQuads, [newQuad]);
    });

    it('should store multiple quads', async function () {
      const { dataFactory, store } = this;
      const newQuads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
      ];
      await store.put(newQuads[0]);
      await store.put(newQuads[1]);
      const {items: foundQuads} = await store.get({});
      equalsQuadArray(foundQuads, newQuads);
    });

    it('should not duplicate quads', async function () {
      const { dataFactory, store } = this;
      const newQuads = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode('ex://o'),
          dataFactory.namedNode('ex://g'),
        ),
        dataFactory.quad(
          dataFactory.namedNode('ex://s2'),
          dataFactory.namedNode('ex://p2'),
          dataFactory.namedNode('ex://o2'),
          dataFactory.namedNode('ex://g2'),
        ),
      ];
      await store.put(newQuads[0]);
      await store.put(newQuads[1]);
      await store.put(newQuads[1]);
      const {items: foundQuads} = await store.get({});
      equalsQuadArray(foundQuads, newQuads);
    });

  });

  describe('Quadstore.prototype.put() with scope', () => {

    it('Should transform blank node labels', async function () {
      const {dataFactory, store} = this;
      const scope = await store.initScope();
      const quadA = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(quadA, { scope });
      const { items: [quadB] } = await store.get({});
      toBeTrue(quadB.subject.equals(quadA.subject));
      toBeTrue(quadB.predicate.equals(quadA.predicate));
      toBeFalse(quadB.object.equals(quadA.object));
      toBeTrue(quadB.graph.equals(quadA.graph));
    });

    it('Should maintain mappings across different invocations', async function () {
      const {dataFactory, store} = this;
      const scope = await store.initScope();
      const quadA = dataFactory.quad(
        dataFactory.namedNode('ex://s1'),
        dataFactory.namedNode('ex://p1'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g1'),
      );
      const quadB = dataFactory.quad(
        dataFactory.namedNode('ex://s2'),
        dataFactory.namedNode('ex://p2'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g2'),
      );
      await store.put(quadA, { scope });
      await store.put(quadB, { scope });
      const { items } = await store.get({});
      arrayToHaveLength(items, 2);
      toBeTrue(items[1].object.equals(items[0].object));
      toBeFalse(items[1].object.equals(quadA.object));
    });

    it('Should persist scope mappings', async function () {
      const {dataFactory, store} = this;
      const scope = await store.initScope();
      const quad = dataFactory.quad(
        dataFactory.namedNode('ex://s'),
        dataFactory.namedNode('ex://p'),
        dataFactory.blankNode('bo'),
        dataFactory.namedNode('ex://g'),
      );
      await store.put(quad, { scope });
      const levelOpts = Scope.getLevelIteratorOpts(true, true, scope.id);
      const entries = await streamToArray(new LevelIterator(
        store.db.iterator(levelOpts),
        (key: string, value: string) => value,
      ));
      toBeAnArray(entries);
      arrayToHaveLength(entries, 1);
      const { originalLabel, randomLabel } = JSON.parse(entries[0]);
      toStrictlyEqual(originalLabel, 'bo');
    });

  });

  describe('Quadstore.prototype.multiPut() with scope', () => {
    it('Should transform blank node labels', async function () {
      const {dataFactory, store} = this;
      const scope = await store.initScope();
      const quadsA = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.blankNode('bo'),
          dataFactory.namedNode('ex://g'),
        ),
      ];
      await store.multiPut(quadsA, { scope });
      const { items: quadsB } = await store.get({});
      arrayToHaveLength(quadsB, 1);
      toBeTrue(quadsB[0].subject.equals(quadsA[0].subject));
      toBeTrue(quadsB[0].predicate.equals(quadsA[0].predicate));
      toBeFalse(quadsB[0].object.equals(quadsA[0].object));
      toBeTrue(quadsB[0].graph.equals(quadsA[0].graph));
    });
  });

  describe('Quadstore.prototype.putStream() with scope', () => {
    it('Should transform blank node labels', async function () {
      const {dataFactory, store} = this;
      const scope = await store.initScope();
      const quadsA = [
        dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.blankNode('bo'),
          dataFactory.namedNode('ex://g'),
        ),
      ];
      await store.putStream(new ArrayIterator(quadsA), { scope });
      const { items: quadsB } = await store.get({});
      arrayToHaveLength(quadsB, 1);
      toBeTrue(quadsB[0].subject.equals(quadsA[0].subject));
      toBeTrue(quadsB[0].predicate.equals(quadsA[0].predicate));
      toBeFalse(quadsB[0].object.equals(quadsA[0].object));
      toBeTrue(quadsB[0].graph.equals(quadsA[0].graph));
    });
  });

  describe('Quadstore.prototype.putStream() with batchSize', () => {

    beforeEach(async function () {
      const { dataFactory } = this;
      const quads = [];
      for (let i = 0; i < 10; i += 1) {
        quads.push(dataFactory.quad(
          dataFactory.namedNode('ex://s'),
          dataFactory.namedNode('ex://p'),
          dataFactory.namedNode(`ex://o${i}`),
          dataFactory.namedNode('ex://g'),
        ));
      }
      this.quads = quads;
    });

    afterEach(async function () {
      const { store, quads } = this;
      const { items } = await store.get({});
      items.sort((a: Quad, b: Quad) => a.object.value < b.object.value ? -1 : 1);
      equalsQuadArray(items, quads);
    });

    it('batchSize set to 1', async function () {
      const { store, quads } = this;
      await store.putStream(new ArrayIterator(quads), { batchSize: 1 });
    });

    it('batchSize set to the number of quads', async function () {
      const { store, quads } = this;
      await store.putStream(new ArrayIterator(quads), { batchSize: 10 });
    });

    it('batchSize set to a perfect divisor of the number of quads', async function () {
      const { store, quads } = this;
      await store.putStream(new ArrayIterator(quads), { batchSize: 2 });
    });

    it('batchSize set to an imperfect divisor of the number of quads', async function () {
      const { store, quads } = this;
      await store.putStream(new ArrayIterator(quads), { batchSize: 3 });
    });

  });


};
