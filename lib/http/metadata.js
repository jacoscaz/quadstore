/* eslint no-multi-spaces: "off" */

'use strict';

module.exports.prefixes = {
  foaf: 'http://xmlns.com/foaf/0.1/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  hydra: 'http://www.w3.org/ns/hydra/core#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  void: 'http://rdfs.org/ns/void#',
  purl: 'http://purl.org/dc/terms/'
};

function generateMetaQuads(baseUrl, thisUrl, totalCount, perPageCount, firstPageUrl, prevPageUrl, nextPageUrl, lastPageUrl) {
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
}

module.exports.generateQuads = generateMetaQuads;
