
'use strict';

const httpUtils = require('../utils');
const querystring = require('querystring');

const sparqlController = {

  _parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        switch (req.headers['content-type']) {
          case 'application/sparql-query':
            return resolve(body);
          case 'application/x-www-form-urlencoded':
            return resolve(querystring.parse(body).query || '');
          default:
            reject(new Error('Unsupported content-type.'));
        }
      });
    });
  },

  _negotiateResultsFormat(res) {
    return new Promise((resolve, reject) => {
      res.format({
        'application/json': () => { resolve('application/json'); },
        'application/sparql-results+xml': () => { resolve('application/sparql-results+xml'); },
        'application/sparql-results+json': () => { resolve('application/sparql-results+json'); },
        'default': () => { reject(new Error('Content-Type negotiation failed.')); }
      });
    });
  },

  _negotiateQuadsFormat(res) {
    return new Promise((resolve, reject) => {
      res.format({
        'application/trig': () => { resolve('application/trig'); },
        'application/n-quads': () => { resolve('application/n-quads'); },
        'default': () => { reject(new Error('Content-Type negotiation failed.')); }
      });
    });
  },

  createHandler(rdfStore) {
    return httpUtils.asyncMiddleware(async (req, res) => {
      let query;
      switch (req.method) {
        case 'POST':
          query = await sparqlController._parseRequestBody(req);
          break;
        case 'GET':
          query = req.query.query || '';
          break;
        default:
          res.status(405).send({message: 'Incorrect HTTP method'});
          return;
      }
      const hasQuadsResult = /\s*(?:CONSTRUCT|DESCRIBE)/i.test(query);
      const resultsFormat = hasQuadsResult
        ? await sparqlController._negotiateQuadsFormat(res)
        : await sparqlController._negotiateResultsFormat(res);
      const resultsStream = await rdfStore.sparql(query, resultsFormat);
      res.set('Content-Type', resultsFormat);
      resultsStream.pipe(res);
    });
  }

};

module.exports = sparqlController;
