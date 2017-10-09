
'use strict';

const _ = require('lodash');
const n3 = require('n3');
const url = require('url');
const yurl = require('yurl');
const http = require('http');
const utils = require('../utils');
const stream = require('stream');
const express = require('express');
const metadata = require('./metadata');
const QuadStore = require('../../').QuadStore;

/*
 * @see https://www.hydra-cg.com/spec/latest/triple-pattern-fragments/
 */

function negotiateResponseContentType(res) {
  return new Promise((resolve, reject) => {
    res.format({
      'application/trig': () => { resolve('application/trig'); },
      'application/n-quads': () => { resolve('application/n-quads'); },
      'default': () => { reject(new Error('Content-Type negotiation failed.')); }
    });
  });
}

function LdfServer(rdfStore, opts) {

  const config = _.defaults(opts, {
    baseUrl: 'http://127.0.0.1:8080',
    prefixes: {},
    maxLimit: 1000,
    perPageCount: 5,
  });

  const server = http.createServer();
  const router = express();
  server.on('request', router);

  server.router = router;
  server.config = config;
  server.rdfStore = rdfStore;

  const connections = [];
  server.on('connection', (socket) => {
    connections.push(socket);
    socket.on('close', () => {
      const i = connections.indexOf(socket);
      if (i >= 0) connections.splice(i, 1);
    })
  });
  server.terminate = function (cb) {
    connections.forEach((socket) => {
      socket.destroy();
    });
    server.close(cb);
  };

  router.get('/ldf', (req, res, next) => {
    (async () => {
      const query = req.query;
      const page = query.page ? parseInt(query.page) : 1;
      if (isNaN(page) || page < 1) {
        res.status(400).end('Invalid page parameter.');
        return;
      }
      const { subject, predicate, object, graph } = req.query;
      const limit = config.perPageCount;
      const offset = (page - 1) * config.perPageCount;
      const terms = {
        subject: subject ? rdfStore._exportTerm(subject) : null,
        predicate: predicate ? rdfStore._exportTerm(predicate) : null,
        object: object ? rdfStore._exportTerm(object) : null,
        graph: graph ? rdfStore._exportTerm(graph) : null,
      };
      const approximateTotalCount = await rdfStore.getApproximateSize(terms);
      const responseContentType = await negotiateResponseContentType(res);
      const writerStream = new n3.StreamWriter({
        format: responseContentType,
        prefixes: _.extend(config.prefixes, metadata.prefixes)
      });
      const quadStream = rdfStore.getStream(terms, { limit, offset });
      const serializerStream = rdfStore._createQuadSerializerStream();
      quadStream.pipe(serializerStream).pipe(writerStream, { end: false }).pipe(res);
      await utils.resolveOnEvent(serializerStream, 'finish', false);
      const quadCount = serializerStream.count;
      const estimatedTotalCount = (quadCount && approximateTotalCount < offset + quadCount)
        ? offset + (quadCount < limit ? quadCount : 2 * quadCount)
        : approximateTotalCount;
      const routeUrl = yurl(config.baseUrl).pathname('ldf').format();
      const thisUrl = yurl(routeUrl).query(false).query(yurl(req.originalUrl)._parts.query).format();
      const nextPageUrl = (estimatedTotalCount > offset + quadCount)
        && yurl(thisUrl).query({ page: page + 1 }).format();
      const prevPageUrl = (page > 1)
        && yurl(thisUrl).query({ page: page - 1 }).format();
      const firstPageUrl = yurl(thisUrl).query({ page: 1 }).format();
      const lastPageUrl = false;
      utils.createArrayStream(metadata.generateQuads(
        routeUrl,
        thisUrl,
        estimatedTotalCount,
        config.perPageCount,
        firstPageUrl,
        prevPageUrl,
        nextPageUrl,
        lastPageUrl
      )).pipe(writerStream);
    })();
  });

  router.get('/match', (req, res, next) => {
    (async () => {
      const query = req.query;
      const { subject, predicate, object, graph } = req.query;
      const limit = query.limit ? parseInt(query.limit) : config.maxLimit;
      const offset = query.offset ? parseInt(query.offset) : 0;
      if (isNaN(limit) || limit < 0 || limit > 1000) {
        res.status(400).end('Invalid limit parameter.');
        return;
      }
      if (isNaN(offset) || offset < 0) {
        res.status(400).end('Invalid offset parameter.');
        return;
      }
      const terms = {
        subject: subject ? rdfStore._exportTerm(subject) : null,
        predicate: predicate ? rdfStore._exportTerm(predicate) : null,
        object: object ? rdfStore._exportTerm(object) : null,
        graph: graph ? rdfStore._exportTerm(graph) : null,
      };
      const responseContentType = await negotiateResponseContentType(res);
      const writerStream = new n3.StreamWriter({
        format: responseContentType,
        prefixes: _.extend(config.prefixes, metadata.prefixes)
      });
      const quadStream = rdfStore.getStream(terms, { limit, offset });
      const serializerStream = rdfStore._createQuadSerializerStream();
      quadStream.pipe(serializerStream).pipe(writerStream).pipe(res);
    })();
  });

  router.post('/import', (req, res, next) => {
    (async () => {
      const parserStream = new n3.StreamParser({ format: req.get('content-type') });
      const quadStream = req.pipe(parserStream).pipe(rdfStore._createQuadDeserializerStream());
      await rdfStore.putStream(quadStream);
      res.status(200).end();
    })();
  });

  router.post('/remove', (req, res, next) => {
    (async () => {
      const parserStream = new n3.StreamParser({ format: req.get('content-type') });
      const quadStream = req.pipe(parserStream).pipe(rdfStore._createQuadDeserializerStream());
      await rdfStore.delStream(quadStream);
      res.status(200).end();
    })();
  });

  return server;
}

module.exports = LdfServer;
