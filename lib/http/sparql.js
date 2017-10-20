
'use strict';

const n3 = require('n3');
const utils = require('../utils');
const debug = require('debug')('quadstore:sparql');
const ldfClient = require('ldf-client');
const asynctools = require('asynctools');
const querystring = require('querystring');

class SparqlController {

  constructor(rdfStore) {
    this._rdfStore = rdfStore;
  }

  static _parseRequestBody(req) {
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
  }

  static _negotiateResultsFormat(res) {
    return new Promise((resolve, reject) => {
      res.format({
        'application/json': () => { resolve('application/json'); },
        'application/sparql-results+xml': () => { resolve('application/sparql-results+xml'); },
        'application/sparql-results+json': () => { resolve('application/sparql-results+json'); },
        'default': () => { reject(new Error('Content-Type negotiation failed.')); }
      });
    });
  }

  _executeQuery(query, resultsFormat) {
    if (!resultsFormat) resultsFormat = 'application/json';
    const fragmentsClient = this._rdfStore._fragmentsClient;
    const sparqlIterator = new ldfClient.SparqlIterator(query, { fragmentsClient });
    switch (sparqlIterator.queryType) {
      // Write JSON representations of the rows or boolean
      case 'ASK':
      case 'SELECT':
        const resultIterator = ldfClient.SparqlResultWriter.instantiate(resultsFormat, sparqlIterator);
        return utils.createIteratorStream(resultIterator);
      // Write an RDF representation of all results
      case 'CONSTRUCT':
      case 'DESCRIBE':
        const streamWriter = new n3.StreamWriter({ format: resultsFormat });
        return utils.createIteratorStream(sparqlIterator).pipe(streamWriter);
      default:
        throw new ldfClient.SparqlIterator.UnsupportedQueryError(query);
    }
  }

  handleRequest(req, res, next) {
    const controller = this;
    asynctools.toCallback(async () => {
      let query;
      switch (req.method) {
        case 'POST':
          query = await SparqlController._parseRequestBody(req);
          break;
        case 'GET':
          query = req.query.query || '';
          break;
        default:
          res.status(405).send({message: 'Incorrect HTTP method'});
          return;
      }
      const hasTriplesResult = /\s*(?:CONSTRUCT|DESCRIBE)/i.test(query);
      const resultsFormat = hasTriplesResult
        ? 'text/turtle'
        : await SparqlController._negotiateResultsFormat(res);
      try {
        const resultsStream = controller._executeQuery(query, resultsFormat);
        res.set('Content-Type', resultsFormat);
        resultsStream.pipe(res);
      } catch (queryErr) {
        debug(queryErr);
        res.status(401).send({ message: queryErr.message });
      }
    }, false, next);
  }

}

module.exports = SparqlController;
