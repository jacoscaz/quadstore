
/*
 * This controller is based on code from
 * - ldf-client/bin/ldf-client.js
 * - ldf-client/bin/ldf-client-http.js
 */

'use strict';

const _ = require('lodash');
const n3 = require('n3');
const httpUtils = require('../utils');

const matchController = {

  _negotiate(res) {
    return new Promise((resolve, reject) => {
      res.format({
        'application/trig': () => { resolve('application/trig'); },
        'application/n-quads': () => { resolve('application/n-quads'); },
        'default': () => { reject(new Error('Content-Type negotiation failed.')); }
      });
    });
  },

  createHandler(rdfStore) {
    const prefixes = {};
    const maxLimit = 999;
    return httpUtils.asyncMiddleware(async (req, res) => {
      const query = req.query;
      const {subject, predicate, object, graph} = req.query;
      const limit = query.limit ? parseInt(query.limit) : maxLimit;
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
      let responseContentType;
      try {
        responseContentType = await matchController._negotiate(res);
      } catch (negotiationErr) {
        res.status(400).end(negotiationErr.message);
        return;
      }
      const writerStream = new n3.StreamWriter({
        format: responseContentType,
        prefixes: _.extend({}, prefixes)
      });
      const quadStream = rdfStore.getStream(terms, {limit, offset});
      quadStream.pipe(writerStream).pipe(res);
    });
  }

};

module.exports = matchController;
