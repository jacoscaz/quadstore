
import { equalsQuadArray } from '../utils/expect';

export const runRangeTests = () => {

  describe.only('Operations with ranges', () => {

    describe('String literals', () => {

      beforeEach(async function () {
        const { dataFactory } = this;
        this.quads = [
          dataFactory.quad(
            dataFactory.namedNode('ex://s0'),
            dataFactory.namedNode('ex://p0'),
            dataFactory.literal('o0'),
            dataFactory.namedNode('ex://c0'),
          ),
          dataFactory.quad(
            dataFactory.namedNode('ex://s1'),
            dataFactory.namedNode('ex://p1'),
            dataFactory.literal('o1'),
            dataFactory.namedNode('ex://c1'),
          ),
          dataFactory.quad(
            dataFactory.namedNode('ex://s2'),
            dataFactory.namedNode('ex://p2'),
            dataFactory.literal('o2'),
            dataFactory.namedNode('ex://c2'),
          ),
          dataFactory.quad(
            dataFactory.namedNode('ex://s3'),
            dataFactory.namedNode('ex://p3'),
            dataFactory.literal('o3'),
            dataFactory.namedNode('ex://c3'),
          ),
        ];
        await this.store.multiPut(this.quads);
      });

      it('should match quads by a specific string literal', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: dataFactory.literal('o2'),
        });
        equalsQuadArray(quads, this.quads.slice(2, 3));
      });

      it('should match quads by a range of string literals (gte)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { termType: 'Range', gte: dataFactory.literal('o1') },
        });
        equalsQuadArray(quads, this.quads.slice(1));
      });

      it('should match quads by a range of string literals (gt)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { termType: 'Range', gt: dataFactory.literal('o1') },
        });
        equalsQuadArray(quads, this.quads.slice(2));
      });

      it('should match quads by a range of string literals (lte)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { termType: 'Range', lte: dataFactory.literal('o2') },
        });
        equalsQuadArray(quads, this.quads.slice(0, 3));
      });

      it('should match quads by a range of string literals (lt)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { termType: 'Range', lt: dataFactory.literal('o2') },
        });
        equalsQuadArray(quads, this.quads.slice(0, 2));
      });

      it('should match quads by a range of string literals (gt,lt)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { 
            termType: 'Range', 
            gt: dataFactory.literal('o0'),
            lt: dataFactory.literal('o3'),
           },
        });
        equalsQuadArray(quads, this.quads.slice(1, 3));
      });

      it('should match quads by a range of string literals (gte,lt)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { 
            termType: 'Range', 
            gte: dataFactory.literal('o0'),
            lt: dataFactory.literal('o3'),
           },
        });
        equalsQuadArray(quads, this.quads.slice(0, 3));
      });

      it('should match quads by a range of string literals (gt,lte)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { 
            termType: 'Range', 
            gt: dataFactory.literal('o0'),
            lte: dataFactory.literal('o3'),
           },
        });
        equalsQuadArray(quads, this.quads.slice(1, 4));
      });

      it('should match quads by a range of string literals (gte,lte)', async function () {
        const { dataFactory, store } = this;
        const { items: quads } = await store.get({
          object: { 
            termType: 'Range', 
            gte: dataFactory.literal('o1'),
            lte: dataFactory.literal('o2'),
           },
        });
        equalsQuadArray(quads, this.quads.slice(1, 3));
      });

    });

  });

};