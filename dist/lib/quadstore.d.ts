/// <reference types="node" />
import { TSBindingArrayResult, TSEmptyOpts, TSIndex, TSPattern, TSQuad, TSQuadArrayResult, TSQuadStreamResult, TSRange, TSReadable, TSSearchStage, TSStore, TSStoreOpts, TSTermName } from './types';
import events from 'events';
import { AbstractLevelDOWN } from 'abstract-leveldown';
declare class QuadStore extends events.EventEmitter implements TSStore {
    readonly db: AbstractLevelDOWN;
    readonly abstractLevelDOWN: AbstractLevelDOWN;
    readonly defaultGraph: string;
    readonly indexes: TSIndex[];
    readonly id: string;
    readonly separator: string;
    readonly boundary: string;
    constructor(opts: TSStoreOpts);
    _initialize(): void;
    close(): void;
    toString(): string;
    toJSON(): string;
    _addIndex(terms: TSTermName[]): void;
    put(quads: TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    del(patternOrQuads: TSPattern | TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    get(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSQuadArrayResult>;
    search(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<TSQuadArrayResult | TSBindingArrayResult>;
    patch(patternOrOldQuads: TSPattern | TSQuad | TSQuad[], newQuads: TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    getApproximateSize(pattern: TSPattern, opts: TSEmptyOpts): Promise<any>;
    getStream(pattern: TSPattern, opts: TSEmptyOpts): Promise<TSQuadStreamResult>;
    searchStream(stages: TSSearchStage[], opts: TSEmptyOpts): Promise<any>;
    putStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<void>;
    delStream(source: TSReadable<TSQuad>, opts: TSEmptyOpts): Promise<void>;
    protected _isQuad(obj: any): boolean;
    protected _delput(oldQuads: TSQuad | TSQuad[], newQuads: TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    protected _getdelput(matchTerms: TSPattern, newQuads: TSQuad | TSQuad[], opts: TSEmptyOpts): Promise<void>;
    protected _quadToBatch(quad: TSQuad, type: 'del' | 'put'): {
        type: "del" | "put";
        key: string;
        value: TSQuad;
    }[];
    _getTermNames(): TSTermName[];
    protected _getTermValueComparator(): (a: string, b: string) => -1 | 0 | 1;
    protected _getQuadComparator(termNames: TSTermName[]): (a: TSQuad, b: TSQuad) => 0 | 1 | -1;
    protected _mergeTermRanges(a: TSRange, b: TSRange): TSRange;
}
export default QuadStore;
