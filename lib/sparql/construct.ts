import {
  TSRdfQuadStreamResult,
  TSRdfSearchStage,
  TSRdfStore,
  TSSearchOpts,
  TSSearchStageType,
  TSSparqlOpts,
} from '../types/index.js';
import {ConstructQuery} from 'sparqljs';
import {sparqlWherePatternArrayToStages} from './select.js';
import {bgpTripleToQuad} from './utils.js';

export const handleSparqlConstruct = async (store: TSRdfStore, parsed: ConstructQuery, opts?: TSSparqlOpts): Promise<TSRdfQuadStreamResult> => {
  const searchOpts: TSSearchOpts = opts ? { ...opts } : {};
  if (!parsed.where) {
    // TODO: is the "WHERE" block mandatory for CONSTRUCT queries?
    throw new Error('missing WHERE pattern group');
  }
  const stages: TSRdfSearchStage[] = sparqlWherePatternArrayToStages(parsed.where);
  if (!parsed.template || parsed.template.length < 1) {
    throw new Error('missing or empty template group in CONSTRUCT query');
  }
  stages.push({
    type: TSSearchStageType.CONSTRUCT,
    patterns: parsed.template.map(triple => bgpTripleToQuad(store, triple)),
  });
  return <TSRdfQuadStreamResult><unknown>(await store.searchStream(stages, searchOpts));
};
