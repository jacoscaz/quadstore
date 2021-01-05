
import {
  DataFactory,
  Quad,
  BlankNode,
  Quad_Subject,
  Quad_Object,
  Quad_Graph,
} from 'rdf-js';
import {
  nanoid,
} from '../utils/nanoid';
import {AbstractChainedBatch} from 'abstract-leveldown';
import {Quadstore} from '../quadstore';
import {LevelIterator} from '../get/leveliterator';
import {consumeOneByOne, pFromCallback} from '../utils';

export class Scope {

  readonly id: string;

  readonly blankNodes: Map<string, BlankNode>;
  readonly factory: DataFactory;

  static boundary = '\uDBFF\uDFFF'
  static separator = '\u0000\u0000'

  static async init(store: Quadstore): Promise<Scope> {
    return new Scope(store.dataFactory, nanoid(), new Map());
  }

  static async load(store: Quadstore, scopeId: string): Promise<Scope> {
    const levelOpts = Scope.getLevelIteratorOpts(false, true, scopeId);
    const iterator = new LevelIterator(
      store.db.iterator(levelOpts),
      (key, value) => (<string>value),
    );
    const blankNodes: Map<string, BlankNode> = new Map();
    const { dataFactory: factory } = store;
    await consumeOneByOne(iterator, (value: string) => {
      const {originalLabel, randomLabel} = JSON.parse(value);
      blankNodes.set(originalLabel, factory.blankNode(randomLabel));
    });
    return new Scope(factory, scopeId, blankNodes);
  }

  static async delete(store: Quadstore, scopeId?: string): Promise<void> {
    const batch = store.db.batch();
    const levelOpts = Scope.getLevelIteratorOpts(true, false, scopeId);
    const iterator = new LevelIterator(
      store.db.iterator(levelOpts),
      (key, value) => key,
    );
    await consumeOneByOne(iterator, (key: string) => {
      batch.del(key);
    });
    await pFromCallback((cb) => { batch.write(cb); });
  }

  static getLevelIteratorOpts(keys: boolean, values: boolean, scopeId?: string) {
    const gte = scopeId
      ? `SCOPE${Scope.separator}${scopeId}${Scope.separator}`
      : `SCOPE${Scope.separator}`;
    return {
      keys,
      values,
      keyAsBuffer: false,
      valueAsBuffer: false,
      gte,
      lte: `${gte}${Scope.boundary}`,
    };
  }

  static addMappingToLevelBatch(scopeId: string, batch: AbstractChainedBatch<any, any>, originalLabel: string, randomLabel: string) {
    batch.put(`SCOPE${Scope.separator}${scopeId}${Scope.separator}${originalLabel}`, JSON.stringify({ originalLabel, randomLabel }));
  }

  constructor(factory: DataFactory, id: string, blankNodes: Map<string, BlankNode>) {
    this.blankNodes = blankNodes;
    this.factory = factory;
    this.id = id;
  }

  private parseBlankNode(node: BlankNode, batch: AbstractChainedBatch<any, any>): BlankNode {
    let cachedNode = this.blankNodes.get(node.value);
    if (!cachedNode) {
      cachedNode = this.factory.blankNode(nanoid());
      this.blankNodes.set(node.value, cachedNode);
      Scope.addMappingToLevelBatch(this.id, batch, node.value, cachedNode.value);
    }
    return cachedNode;
  }

  private parseSubject(node: Quad_Subject, batch: AbstractChainedBatch<any, any>): Quad_Subject {
    switch (node.termType) {
      case 'BlankNode':
        return this.parseBlankNode(node, batch);
      default:
        return node;
    }
  }

  private parseObject(node: Quad_Object, batch: AbstractChainedBatch<any, any>): Quad_Object {
    switch (node.termType) {
      case 'BlankNode':
        return this.parseBlankNode(node, batch);
      default:
        return node;
    }
  }

  private parseGraph(node: Quad_Graph, batch: AbstractChainedBatch<any, any>): Quad_Graph {
    switch (node.termType) {
      case 'BlankNode':
        return this.parseBlankNode(node, batch);
      default:
        return node;
    }
  }

  parseQuad(quad: Quad, batch: AbstractChainedBatch<any, any>): Quad {
    return this.factory.quad(
      this.parseSubject(quad.subject, batch),
      quad.predicate,
      this.parseObject(quad.object, batch),
      this.parseGraph(quad.graph, batch),
    );
  }

}
