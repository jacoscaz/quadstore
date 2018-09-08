
'use strict';

const _ = require('lodash');
const n3 = require('n3');
const YURL = require('yurl');
const utils = require('../../utils')
const debug = require('debug')('quadstore:http:ldf');
const stream = require('stream');
const httpUtils = require('../utils');

function createCounterStream() {
  return Object.assign(new stream.Transform({
    objectMode: true,
    transform(item, enc, cb) {
      this.push(item);
      this.count += 1;
      cb();
    }
  }), {count: 0});
}

function createDumperStream() {
  let b = '';
  const t = new stream.Transform({
    objectMode: false,
    transform(chunk, enc, cb) {
      b += chunk.toString();
      this.push(chunk);
      cb();
    }
  });
  t.on('finish', () => {
    t.emit('dump', b);
  });
  return t;
}

// ALTERNATIVE DEFINITION OF graph PROPERTY
// BASED ON RDFG
// `
// _:_graph_ a rdf:Property ;
//   rdfs:label "graph" ;
//   rdfs:comment "The graph of the subject RDF statement." ;
//   rdfs:domain rdf:Statement ;
//   rdfs:range rdfg:Graph.
// `

const ldfController = {

  _metaPrefixes: {
    sd: 'http://www.w3.org/ns/sparql-service-description#',
    foaf: 'http://xmlns.com/foaf/0.1/',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    hydra: 'http://www.w3.org/ns/hydra/core#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    void: 'http://rdfs.org/ns/void#',
    purl: 'http://purl.org/dc/terms/'
  },

  _generateMetaQuads(baseUrl, thisUrl, totalCount, perPageCount, firstPageUrl, prevPageUrl, nextPageUrl, lastPageUrl, rdfStore) {
    const {sd, foaf, rdf, rdfs, hydra, xsd, purl} = this._metaPrefixes;
    const voidNs = this._metaPrefixes.void;
    const {literal, blankNode, namedNode, quad} = rdfStore._dataFactory;
    const defaultGraphUri = rdfStore._defaultContextValue;
    const metaQuads = [
      quad(namedNode(`${baseUrl}#metadata`), namedNode(`${foaf}primaryTopic`),            namedNode(`${baseUrl}`),                                    namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`pattern`),             namedNode(`${hydra}template`),               literal(`${baseUrl}{?subject,predicate,object,graph}`),     namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`pattern`),             namedNode(`${hydra}variableRepresentation`), namedNode(`${hydra}ExplicitRepresentation`),                namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`pattern`),             namedNode(`${hydra}mapping`),                blankNode(`subject`),                                       namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`pattern`),             namedNode(`${hydra}mapping`),                blankNode(`predicate`),                                     namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`pattern`),             namedNode(`${hydra}mapping`),                blankNode(`object`),                                        namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`pattern`),             namedNode(`${hydra}mapping`),                blankNode(`graph`),                                         namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`subject`),             namedNode(`${hydra}variable`),               literal(`subject`),                                         namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`subject`),             namedNode(`${hydra}property`),               namedNode(`${rdf}subject`),                                 namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`predicate`),           namedNode(`${hydra}variable`),               literal(`predicate`),                                       namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`predicate`),           namedNode(`${hydra}property`),               namedNode(`${rdf}predicate`),                               namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`object`),              namedNode(`${hydra}variable`),               literal(`object`),                                          namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`object`),              namedNode(`${hydra}property`),               namedNode(`${rdf}object`),                                  namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`graph`),               namedNode(`${hydra}variable`),               literal(`graph`),                                           namedNode(`${baseUrl}#metadata`)),
      quad(blankNode(`graph`),               namedNode(`${hydra}property`),               namedNode(`${sd}graph`),                                    namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${hydra}search`),                 blankNode(`pattern`),                                       namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${hydra}member`),                 namedNode(`${baseUrl}#dataset`),                            namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${voidNs}subset`),                namedNode(`${baseUrl}`),                                    namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${voidNs}uriLookupEndpoint`),     literal(`${baseUrl}{?subject,predicate,object,graph}`),     namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${rdf}type`),                     namedNode(`${voidNs}Dataset`),                              namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${rdf}type`),                     namedNode(`${hydra}Collection`),                            namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${baseUrl}#dataset`),  namedNode(`${sd}defaultGraph`),              namedNode(defaultGraphUri),                                 namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${purl}title`),                   literal(`Linked Data Fragment of rdfstore`, `en`),          namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${purl}description`),             literal(`Quad Pattern Fragment.`, `en`),                    namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${purl}source`),                  namedNode(`${baseUrl}#dataset`),                            namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${hydra}itemsPerPage`),           literal(`${perPageCount}`, namedNode(`${xsd}integer`)),     namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${hydra}totalItems`),             literal(`${totalCount}`, namedNode(`${xsd}integer`)),       namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${hydra}first`),                  namedNode(`${firstPageUrl}`),                               namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${voidNs}triples`),               literal(`${totalCount}`, namedNode(`${xsd}integer`)),       namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${voidNs}subset`),                namedNode(`${thisUrl}`),                                    namedNode(`${baseUrl}#metadata`)),
      quad(namedNode(`${thisUrl}`),          namedNode(`${rdf}type`),                     namedNode(`${hydra}PartialCollectionView`),                 namedNode(`${baseUrl}#metadata`)),
    ];
    if (nextPageUrl) metaQuads.push(quad(namedNode(`${thisUrl}`), namedNode(`${hydra}next`), namedNode(`${nextPageUrl}`), namedNode(`${baseUrl}#metadata`)));
    if (prevPageUrl) metaQuads.push(quad(namedNode(`${thisUrl}`), namedNode(`${hydra}previous`), namedNode(`${prevPageUrl}`), namedNode(`${baseUrl}#metadata`)));
    if (lastPageUrl) metaQuads.push(quad(namedNode(`${thisUrl}`), namedNode(`${hydra}last`), namedNode(`${lastPageUrl}`), namedNode(`${baseUrl}#metadata`)));
    return metaQuads;
  },

  _negotiate(res) {
    return new Promise((resolve, reject) => {
      res.format({
        'application/trig': () => { resolve('application/trig'); },
        'application/n-quads': () => { resolve('application/n-quads'); },
        'default': () => { reject(new Error('Content-Type negotiation failed.')); }
      });
    });
  },

  createHandler(rdfStore, routeUrl) {
    const perPageCount = 200;
    return httpUtils.asyncMiddleware(async (req, res) => {
      const query = req.query;
      const page = query.page ? parseInt(query.page) : 1;
      if (isNaN(page) || page < 1) {
        res.status(400).end('Invalid page parameter.');
        return;
      }
      const { subject, predicate, object, graph } = req.query;
      debug('query: %j', req.query);
      const limit = perPageCount;
      const offset = (page - 1) * perPageCount;
      debug(`page: ${page}, offset: ${offset}, limit: ${limit}`);
      const terms = {
        subject: subject ? rdfStore._exportTerm(subject) : null,
        predicate: predicate ? rdfStore._exportTerm(predicate) : null,
        object: object ? rdfStore._exportTerm(object) : null,
        graph: graph ? rdfStore._exportTerm(graph) : null,
      };
      debug('terms: %j', terms);
      const approximateCount = await rdfStore.getApproximateCount(terms);
      let responseContentType;
      try {
        responseContentType = await ldfController._negotiate(res);
      } catch (negotiationErr) {
        res.status(400).end(negotiationErr.message);
        return;
      }
      const writerStream = new n3.StreamWriter({
        format: responseContentType
      });
      const quadStream = rdfStore.getStream(terms, { limit, offset });
      const counterStream = createCounterStream();
      quadStream.pipe(counterStream)
        .pipe(writerStream, { end: false })
        // .pipe(createDumperStream())
        //   .on('dump', (dump) => { console.log('DUMP', dump);})
        .pipe(res);
      await utils.resolveOnEvent(counterStream, 'finish', false);
      const quadCount = counterStream.count;
      const estimatedTotalCount = (quadCount && approximateCount < offset + quadCount)
        ? offset + (quadCount < limit ? quadCount : 2 * quadCount)
        : approximateCount;
      debug(`quadCount: ${quadCount}, approximateTotalCount: ${approximateCount}, estimatedTotalCount: ${estimatedTotalCount}`);
      const thisUrl = new YURL(routeUrl).query(false).query(new YURL(`http://example.com/${req.originalUrl}`).parts.query).format();
      const nextPageUrl = (estimatedTotalCount > offset + quadCount)
        && new YURL(thisUrl).query({ page: page + 1 }).format();
      const prevPageUrl = (page > 1)
        && new YURL(thisUrl).query({ page: page - 1 }).format();
      const firstPageUrl = new YURL(thisUrl).query({ page: 1 }).format();
      const lastPageUrl = false;
      utils.createArrayStream(ldfController._generateMetaQuads(
        routeUrl, thisUrl,
        estimatedTotalCount, perPageCount,
        firstPageUrl, prevPageUrl, nextPageUrl, lastPageUrl,
        rdfStore
      )).pipe(writerStream);
    });
  }

};

module.exports = ldfController;
