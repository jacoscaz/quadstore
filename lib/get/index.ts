import {
  ApproximateSizeResult,
  DefaultGraphMode,
  GetOpts,
  ImportedPattern,
  ImportedPatternTypes, ImportedQuad,
  ImportedRange,
  InternalIndex,
  QuadStreamResult,
  ResultType,
  TermName,
  Quad,
} from '../types';
import {SimpleTransformIterator, BufferedIterator} from 'asynciterator';
import {Quadstore} from '../quadstore';
import {deserializeImportedQuad, exportQuad} from '../serialization';
import {emptyObject} from '../utils';
import {AbstractIterator} from 'abstract-leveldown';
import {LevelIterator} from './leveliterator';


type RangeOpts = {
  lt: string,
  gt: string,
  limit?: number,
  offset?: number,
  lte: boolean,
  ltr: boolean,
  gte: boolean,
  gtr: boolean,
  index: InternalIndex
};

type LevelOpts = {
  keys?: boolean,
  values?: boolean,
  keyAsBuffer?: boolean,
  valueAsBuffer?: boolean,
  lt?: string,
  lte?: string,
  gt?: string,
  gte?: string,
  limit?: number,
  offset?: number,
  reverse?: boolean,
};

const getPatternTypes = (pattern: ImportedPattern): ImportedPatternTypes => {
  return {
    subject: typeof pattern.subject,
    predicate: typeof pattern.predicate,
    object: typeof pattern.object,
    graph: typeof pattern.graph,
  };
};

export const compileGetKeyFn = (indexName: string, separator: string, terms: TermName[]) => {
  return eval(
    '(quad) => `'
    + indexName + separator
    + terms.map(term => `\${quad['${term}']}${separator}`).join('')
    + '`'
  );
}

export const compileCanBeUsedWithPatternFn = (terms: TermName[]): (pattern: ImportedPattern) => boolean => {
  let fn = `
    (patternTypes) => {
      let gotRange = false;
      let gotUndefined  = false;
  `;
  for (let i = 0; i < terms.length; i += 1) {
    fn += `
      if (patternTypes.${terms[i]} === 'undefined') {
        if (!gotUndefined) { 
          gotUndefined = true; 
        }
      } else {
        if (gotUndefined) { 
          return false; 
        }
        if (gotRange) {
          return false;
        }
        if (patternTypes.${terms[i]} === 'object') {
          gotRange = true; 
        }
      }
    `;
  }
  fn += `
      return true;
    }
  `;
  return eval(fn);
};

const capRangeOpts = (rangeOpts: RangeOpts, store: Quadstore, index: InternalIndex) => {
  if (rangeOpts.lte) {
    if (rangeOpts.ltr) {
      rangeOpts.lt += store.boundary;
    } else {
      rangeOpts.lt += store.separator + store.boundary;
    }
  } else {
    if (rangeOpts.ltr) {
      rangeOpts.lt += store.separator;
    } else {
      rangeOpts.lt += store.separator;
    }
  }
  if (rangeOpts.gte) {
    if (!rangeOpts.gtr) {
      rangeOpts.gt += store.separator;
    }
  } else {
    if (rangeOpts.gtr) {
      rangeOpts.gt += store.boundary;
    } else {
      rangeOpts.gt += store.separator + store.boundary;
    }
  }
}

const fillRangeOpts = (levelOpts: RangeOpts, store: Quadstore, index: InternalIndex, term: TermName, valueOrRange: string|ImportedRange|undefined) => {
  switch (typeof(valueOrRange)) {
    case 'string':
      levelOpts.lt += store.separator + valueOrRange;
      levelOpts.gt += store.separator + valueOrRange;
      levelOpts.lte = true;
      levelOpts.gte = true;
      levelOpts.ltr = false;
      levelOpts.gtr = false;
      break;
    case 'object':
      if (valueOrRange.lte) {
        levelOpts.lt += store.separator + valueOrRange.lte;
        levelOpts.lte = true;
        levelOpts.ltr = true;
      } else if (valueOrRange.lt) {
        levelOpts.lt += store.separator + valueOrRange.lt;
        levelOpts.lte = false;
        levelOpts.ltr = true;
      }
      if (valueOrRange.gte) {
        levelOpts.gt += store.separator + valueOrRange.gte;
        levelOpts.gte = true;
        levelOpts.gtr = true;
      } else if (valueOrRange.gt) {
        levelOpts.gt += store.separator + valueOrRange.gt;
        levelOpts.gte = false;
        levelOpts.gtr = true;
      }
      break;
    case 'undefined':
      break;
    default:
      throw new Error('unsupported');
  }
};

export const getRangeOpts = (store: Quadstore, pattern: ImportedPattern, opts?: GetOpts): RangeOpts => {
  const patternTypes = getPatternTypes(pattern);
  let index = store.indexes.find(index => index.canBeUsedWithPattern(patternTypes));
  if (!index) {
    throw new Error(`No index found for pattern ${JSON.stringify(pattern)}`);
  }
  const rangeOpts: RangeOpts = {
    index: index,
    lt: index.name,
    gt: index.name,
    lte: true,
    ltr: false,
    gte: true,
    gtr: false,
    limit: opts ? opts.limit : undefined,
    offset: opts ? opts.offset : undefined,
  };
  for (let i = 0, termName; i < index.terms.length; i += 1) {
    termName = index.terms[i];
    fillRangeOpts(rangeOpts, store, index, termName, pattern[termName]);
  }
  capRangeOpts(rangeOpts, store, index);
  return rangeOpts;
};

const rangeToLevelOpts = (rangeOpts: RangeOpts): LevelOpts => {
  const levelOpts: LevelOpts = {
    keys: false,
    values: true,
    keyAsBuffer: true,
    valueAsBuffer: true,
  };
  if (rangeOpts.lte) {
    levelOpts.lte = rangeOpts.lt;
  } else if (rangeOpts.lt) {
    levelOpts.lt = rangeOpts.lt;
  }
  if (rangeOpts.gte) {
    levelOpts.gte = rangeOpts.gt;
  } else if (rangeOpts.gt) {
    levelOpts.gt = rangeOpts.gt;
  }
  if (rangeOpts.limit) {
    levelOpts.limit = rangeOpts.limit;
  }
  if (rangeOpts.offset) {
    levelOpts.offset = rangeOpts.offset;
  }
  return levelOpts;
};

const reconcilePatternWithDefaultGraphMode = (pattern: ImportedPattern, store: Quadstore, opts: GetOpts = emptyObject): ImportedPattern => {
  const defaultGraphMode = opts.defaultGraphMode || store.defaultGraphMode;
  if (defaultGraphMode === DefaultGraphMode.DEFAULT && !pattern[TermName.GRAPH]) {
    return {
      ...pattern,
      [TermName.GRAPH]: store.defaultGraph,
    };
  }
  if (store.sparqlMode && defaultGraphMode === DefaultGraphMode.UNION && pattern[TermName.GRAPH] === store.defaultGraph) {
    return {
      [TermName.SUBJECT]: pattern[TermName.SUBJECT],
      [TermName.PREDICATE]: pattern[TermName.PREDICATE],
      [TermName.OBJECT]: pattern[TermName.OBJECT],
    };
  }
  return pattern;
};



export const getStream = async (store: Quadstore, pattern: ImportedPattern, opts?: GetOpts): Promise<QuadStreamResult> => {
  pattern = reconcilePatternWithDefaultGraphMode(pattern, store, opts);
  const rangeOpts = getRangeOpts(store, pattern, opts);
  const levelOpts = rangeToLevelOpts(rangeOpts);
  const iterator = new LevelIterator(store, store.db.iterator(levelOpts));

  // const iterator = new SimpleTransformIterator(store.db.createValueStream(levelOpts),{
  //   map(buf: Buffer) {
  //     return exportQuad(
  //       deserializeImportedQuad(buf.toString('utf8')),
  //       store.defaultGraph,
  //       store.dataFactory,
  //       store.prefixes,
  //     );
  //   },
  // });
  return { type: ResultType.QUADS, iterator };
};

export const getApproximateSize = async (store: Quadstore, pattern: ImportedPattern, opts?: GetOpts): Promise<ApproximateSizeResult> => {
  pattern = reconcilePatternWithDefaultGraphMode(pattern, store, opts);
  if (!store.db.approximateSize) {
    return { type: ResultType.APPROXIMATE_SIZE, approximateSize: Infinity };
  }
  const rangeOpts = getRangeOpts(store, pattern, opts);
  const levelOpts = rangeToLevelOpts(rangeOpts);
  const start = levelOpts.gte || levelOpts.gt;
  const end = levelOpts.lte || levelOpts.lt;
  return new Promise((resolve, reject) => {
    store.db.approximateSize(start, end, (err: Error|null, approximateSize: number) => {
      err ? reject(err) : resolve({ type: ResultType.APPROXIMATE_SIZE, approximateSize });
    });
  });
};
