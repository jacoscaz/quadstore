
import type { Quad } from '@rdfjs/types';
import type { AbstractChainedBatch } from 'abstract-level';

import { toEqualUint8Array } from '../utils/expect.js';

const encoder = new TextEncoder();

export const runPrewriteTests = () => {

  describe('Quadstore preWrite option', () => {

    let quads: Quad[];
    const prewriteValue = encoder.encode('value1');

    beforeEach(function () {
      const { dataFactory } = this;
      quads = [
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
    });

    it('should pre-write kvps when putting a quad', async function () {
      const { store } = this;
      await store.put(quads[0], {
        preWrite: (batch: AbstractChainedBatch<any, any, any>) => batch.put('key1', prewriteValue)
      });
      const value = await store.db.get('key1', { valueEncoding: 'view' });
      toEqualUint8Array(prewriteValue, value);
    });

    it('should pre-write kvps when putting quads', async function () {
      const { store } = this;
      await store.multiPut(quads, {
        preWrite: (batch: AbstractChainedBatch<any, any, any>) => batch.put('key1', prewriteValue)
      });
      const value = await store.db.get('key1', { valueEncoding: 'view' });
      toEqualUint8Array(prewriteValue, value);
    });

    it('should pre-write kvps when deleting a quad', async function () {
      const { store } = this;
      await store.put(quads[0]);
      await store.del(quads[0], {
        preWrite: (batch: AbstractChainedBatch<any, any, any>) => batch.put('key1', prewriteValue)
      });
      const value = await store.db.get('key1', { valueEncoding: 'view' });
      toEqualUint8Array(prewriteValue, value);
    });

    it('should pre-write kvps when deleting quads', async function () {
      const { store } = this;
      await store.multiPut(quads);
      await store.multiDel(quads, {
        preWrite: (batch: AbstractChainedBatch<any, any, any>) => batch.put('key1', prewriteValue)
      });
      const value = await store.db.get('key1', { valueEncoding: 'view' });
      toEqualUint8Array(prewriteValue, value);
    });

    it('should pre-write kvps when patching a quad', async function () {
      const { store } = this;
      await store.put(quads[0]);
      await store.patch(quads[0], quads[1], {
        preWrite: (batch: AbstractChainedBatch<any, any, any>) => batch.put('key1', prewriteValue)
      });
      const value = await store.db.get('key1', { valueEncoding: 'view' });
      toEqualUint8Array(prewriteValue, value);
    });

    it('should pre-write kvps when patching quads', async function () {
      const { store } = this;
      await store.multiPut([quads[0]]);
      await store.multiPatch([quads[0]], [quads[1]], {
        preWrite: (batch: AbstractChainedBatch<any, any, any>) => batch.put('key1', prewriteValue)
      });
      const value = await store.db.get('key1', { valueEncoding: 'view' });
      toEqualUint8Array(prewriteValue, value);
    });

  });

};
