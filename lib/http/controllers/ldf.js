
'use strict';

const _ = require('lodash');
const n3 = require('n3');
const yurl = require('yurl');
const utils = require('../../utils');
const debug = require('debug')('quadstore:http:ldf');
const ldfClient = require('ldf-client');
const asynctools = require('asynctools');
const querystring = require('querystring');

const ldfController = {

  _metaPrefixes: {
    foaf: 'http://xmlns.com/foaf/0.1/',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    hydra: 'http://www.w3.org/ns/hydra/core#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    void: 'http://rdfs.org/ns/void#',
    purl: 'http://purl.org/dc/terms/'
  },

  _generateMetaQuads(baseUrl, thisUrl, totalCount, perPageCount, firstPageUrl, prevPageUrl, nextPageUrl, lastPageUrl) {
    const metaQuads = [
      { subject: `${baseUrl}#metadata`, predicate: 'foaf:primaryTopic',            object: `${baseUrl}`,                              graph: `${baseUrl}#metadata` },
      { subject: '_:pattern',           predicate: 'hydra:template',               object: `"${baseUrl}{?subject,predicate,object}"`, graph: `${baseUrl}#metadata` },
      { subject: '_:pattern',           predicate: 'hydra:variableRepresentation', object: 'hydra:ExplicitRepresentation',            graph: `${baseUrl}#metadata` },
      { subject: '_:pattern',           predicate: 'hydra:mapping',                object: '_:subject',                               graph: `${baseUrl}#metadata` },
      { subject: '_:pattern',           predicate: 'hydra:mapping',                object: '_:predicate',                             graph: `${baseUrl}#metadata` },
      { subject: '_:pattern',           predicate: 'hydra:mapping',                object: '_:object',                                graph: `${baseUrl}#metadata` },
      { subject: '_:subject',           predicate: 'hydra:variable',               object: '"subject"',                               graph: `${baseUrl}#metadata` },
      { subject: '_:subject',           predicate: 'hydra:property',               object: 'rdf:subject',                             graph: `${baseUrl}#metadata` },
      { subject: '_:predicate',         predicate: 'hydra:variable',               object: '"predicate"',                             graph: `${baseUrl}#metadata` },
      { subject: '_:predicate',         predicate: 'hydra:property',               object: 'rdf:predicate',                           graph: `${baseUrl}#metadata` },
      { subject: '_:object',            predicate: 'hydra:variable',               object: '"object"',                                graph: `${baseUrl}#metadata` },
      { subject: '_:object',            predicate: 'hydra:property',               object: 'rdf:object',                              graph: `${baseUrl}#metadata` },
      { subject: `${baseUrl}#dataset`,  predicate: 'hydra:search',                 object: '_:pattern',                               graph: `${baseUrl}#metadata` },
      { subject: `${baseUrl}#dataset`,  predicate: 'hydra:member',                 object: `${baseUrl}#dataset`,                      graph: `${baseUrl}#metadata` },
      { subject: `${baseUrl}#dataset`,  predicate: 'void:subset',                  object: `${baseUrl}`,                              graph: `${baseUrl}#metadata` },
      { subject: `${baseUrl}#dataset`,  predicate: 'void:uriLookupEndpoint',       object: `"${baseUrl}{?subject,predicate,object}"`, graph: `${baseUrl}#metadata` },
      { subject: `${baseUrl}#dataset`,  predicate: 'rdf:type',                     object: 'void:Dataset',                            graph: `${baseUrl}#metadata` },
      { subject: `${baseUrl}#dataset`,  predicate: 'rdf:type',                     object: 'hydra:Collection',                        graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'purl:title',                   object: '"Linked Data Fragment of rdfstore"@en',   graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'purl:description',             object: '"Triple/Quad Pattern Fragment."@en',      graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'purl:source',                  object: `${baseUrl}#dataset`,                      graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'hydra:itemsPerPage',           object: `"${perPageCount}"^^xsd:integer`,          graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'hydra:totalItems',             object: `"${totalCount}"^^xsd:integer`,            graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'hydra:first',                  object: `${firstPageUrl}`,                         graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'void:triples',                 object: `"${totalCount}"^^xsd:integer`,            graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'void:subset',                  object: `${thisUrl}`,                              graph: `${baseUrl}#metadata` },
      { subject: `${thisUrl}`,          predicate: 'rdf:type',                     object: 'hydra:PartialCollectionView',             graph: `${baseUrl}#metadata` },
    ];
    if (nextPageUrl) metaQuads.push({ subject: `${thisUrl}`, predicate: 'hydra:next',     object: `${nextPageUrl}`,   graph: `${baseUrl}#metadata` });
    if (prevPageUrl) metaQuads.push({ subject: `${thisUrl}`, predicate: 'hydra:previous', object: `${prevPageUrl}`,   graph: `${baseUrl}#metadata` });
    if (lastPageUrl) metaQuads.push({ subject: `${thisUrl}`, predicate: 'hydra:last',     object: `${lastPageUrl}`,   graph: `${baseUrl}#metadata` });
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
    const prefixes = {};
    const perPageCount = 200;
    return (req, res, next) => {
      asynctools.toCallback(async () => {
        const query = req.query;
        const page = query.page ? parseInt(query.page) : 1;
        if (isNaN(page) || page < 1) {
          res.status(400).end('Invalid page parameter.');
          return;
        }
        const { subject, predicate, object, graph } = req.query;
        const limit = perPageCount;
        const offset = (page - 1) * perPageCount;
        debug(`page: ${page}, offset: ${offset}, limit: ${limit}`);
        const terms = {
          subject: subject ? rdfStore._exportTerm(subject) : null,
          predicate: predicate ? rdfStore._exportTerm(predicate) : null,
          object: object ? rdfStore._exportTerm(object) : null,
          graph: graph ? rdfStore._exportTerm(graph) : null,
        };
        const approximateTotalCount = await rdfStore.getApproximateSize(terms);
        let responseContentType;
        try {
          responseContentType = await ldfController._negotiate(res);
        } catch (negotiationErr) {
          res.status(400).end(negotiationErr.message);
          return;
        }
        const writerStream = new n3.StreamWriter({
          format: responseContentType,
          prefixes: _.extend({}, prefixes, ldfController._metaPrefixes)
        });
        const quadStream = rdfStore.getStream(terms, { limit, offset });
        const serializerStream = rdfStore._createQuadSerializerStream();
        quadStream.pipe(serializerStream).pipe(writerStream, { end: false }).pipe(res);
        await utils.resolveOnEvent(serializerStream, 'finish', false);
        const quadCount = serializerStream.count;
        const estimatedTotalCount = (quadCount && approximateTotalCount < offset + quadCount)
          ? offset + (quadCount < limit ? quadCount : 2 * quadCount)
          : approximateTotalCount;
        debug(`quadCount: ${quadCount}, approximateTotalCount: ${approximateTotalCount}, estimatedTotalCount: ${estimatedTotalCount}`);
        const thisUrl = yurl(routeUrl).query(false).query(yurl(req.originalUrl)._parts.query).format();
        const nextPageUrl = (estimatedTotalCount > offset + quadCount)
          && yurl(thisUrl).query({ page: page + 1 }).format();
        const prevPageUrl = (page > 1)
          && yurl(thisUrl).query({ page: page - 1 }).format();
        const firstPageUrl = yurl(thisUrl).query({ page: 1 }).format();
        const lastPageUrl = false;
        utils.createArrayStream(ldfController._generateMetaQuads(
          routeUrl, thisUrl,
          estimatedTotalCount, perPageCount,
          firstPageUrl, prevPageUrl, nextPageUrl, lastPageUrl
        )).pipe(writerStream);
      }, false, next);
    };
  }

};

module.exports = ldfController;
