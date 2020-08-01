import {
  TSEmptyOpts,
  TSRdfQuadStreamResult,
  TSRdfStore, TSSparqlOpts,
} from '../types/index.js';
import {ConstructQuery} from 'sparqljs';
import {handleSparqlSelect, TSHandleSparqlSelectOpts} from './select.js';
import {bgpTripleToQuad} from './utils.js';

export const handleSparqlConstruct = async (store: TSRdfStore, parsed: ConstructQuery, opts?: TSSparqlOpts): Promise<TSRdfQuadStreamResult> => {
  const selectOpts: TSHandleSparqlSelectOpts = opts ? { ...opts } : {};
  if (parsed.template && parsed.template.length > 0) {
    selectOpts.construct = {
      patterns: parsed.template.map(triple => bgpTripleToQuad(store, triple)),
    };
  }
  return <TSRdfQuadStreamResult><unknown>(await handleSparqlSelect(store, { where: parsed.where }, selectOpts));
};
