
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
const stoppable = require('stoppable');

/*
 * @see https://www.hydra-cg.com/spec/latest/triple-pattern-fragments/
 */

class HttpServer extends http.Server {

  constructor(rdfStore, opts) {
    super();
    const server = this;
    stoppable(server, 100);
    server.config = _.defaults({}, opts, {
      baseUrl: 'http://127.0.0.1:8080',
      prefixes: {},
      maxLimit: 1000,
      perPageCount: 50,
    });
    const router = server.router = express();
    server.emit('init', router);
    router.get('/ldf', (req, res, next) => {
      server._GETLdf(req, res, next);
    });
    router.get('/match', (req, res, next) => {
      server._GETMatch(req, res, next);
    });
    router.post('/import', (req, res, next) => {
      server._POSTImport(req, res, next);
    });
    router.post('/remove', (req, res, next) => {
      server._POSTRemove(req, res, next);
    });
    this.on('request', router);
    server.rdfStore = rdfStore;
  }

  terminate(cb) {
    const server = this;
    function _terminate(resolve, reject) {
      server.stop((err) => {
        err ? reject(err) : resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_terminate);
    }
    _terminate(cb.bind(null, null), cb);
  }

  _GETLdf(req, res, next) {
    const server = this;
    (async () => {
      const config = server.config;
      const rdfStore = server.rdfStore;
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
      const responseContentType = await HttpServer._negotiate(res);
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
    })().catch(next);
  }

  _GETMatch(req, res, next) {
    const server = this;
    (async () => {
      const config = server.config;
      const rdfStore = server.rdfStore;
      const query = req.query;
      const {subject, predicate, object, graph} = req.query;
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
      const responseContentType = await HttpServer._negotiate(res);
      const writerStream = new n3.StreamWriter({
        format: responseContentType,
        prefixes: _.extend(config.prefixes, metadata.prefixes)
      });
      const quadStream = rdfStore.getStream(terms, {limit, offset});
      const serializerStream = rdfStore._createQuadSerializerStream();
      quadStream.pipe(serializerStream).pipe(writerStream).pipe(res);
    })().catch(next);
  }

  _POSTImport(req, res, next) {
    const server = this;
    (async () => {
      const config = server.config;
      const rdfStore = server.rdfStore;
      const parserStream = new n3.StreamParser({format: req.get('content-type')});
      const quadStream = req.pipe(parserStream).pipe(rdfStore._createQuadDeserializerStream());
      await rdfStore.putStream(quadStream);
      res.status(200).end();
    })().catch(next);
  }

  _POSTRemove(req, res, next) {
    const server = this;
    (async () => {
      const config = server.config;
      const rdfStore = server.rdfStore;
      const parserStream = new n3.StreamParser({format: req.get('content-type')});
      const quadStream = req.pipe(parserStream).pipe(rdfStore._createQuadDeserializerStream());
      await rdfStore.delStream(quadStream);
      res.status(200).end();
    })().catch(next);
  }

  static _negotiate(res, cb) {
    function __negotiate(resolve, reject) {
      res.format({
        'application/trig': () => { resolve('application/trig'); },
        'application/n-quads': () => { resolve('application/n-quads'); },
        'default': () => { reject(new Error('Content-Type negotiation failed.')); }
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(__negotiate);
    }
    __negotiate(cb.bind(null, null), cb);
  }

}

module.exports = HttpServer;
