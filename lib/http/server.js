
'use strict';

const _ = require('lodash');
const YURL = require('yurl');
const http = require('http');
const debug = require('debug')('quadstore:server');
const express = require('express');
const stoppable = require('stoppable');

const ldfController = require('./controllers/ldf');
const matchController = require('./controllers/match');
const sparqlController = require('./controllers/sparql');
const importController = require('./controllers/import');
const removeController = require('./controllers/remove');

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
    router.use((req, res, next) => {
      const now = Date.now();
      debug(`${req.method} ${req.originalUrl} (new request)`);
      res.on('finish', () => {
        const then = Date.now();
        debug(`${req.method} ${req.originalUrl} (${then - now}ms) (finished)`);
      });
      next();
    });
    const ldfRouteUrl = new YURL(server.config.baseUrl).pathname('ldf').format();
    router.get('/ldf', ldfController.createHandler(rdfStore, ldfRouteUrl));
    router.all('/sparql', sparqlController.createHandler(rdfStore));
    router.get('/match', matchController.createHandler(rdfStore));
    router.post('/import', importController.createHandler(rdfStore));
    router.post('/remove', removeController.createHandler(rdfStore));
    this.on('request', router);
    server.rdfStore = rdfStore;
  }

  terminate(cb) {
    const server = this;
    function _terminate(resolve, reject) {
      server.stop((err) => {
        if (err) reject(err);
        else resolve();
      });
    }
    if (!_.isFunction(cb)) {
      return new Promise(_terminate);
    }
    _terminate(cb.bind(null, null), cb);
  }

}

module.exports = HttpServer;
