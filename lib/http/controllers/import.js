
'use strict';

const n3 = require('n3');
const stream = require('stream');
const httpUtils = require('../utils');

const importController = {

  createHandler(rdfStore) {
    return httpUtils.asyncMiddleware(async (req, res) => {
      const parserStream = new n3.StreamParser({format: req.get('content-type')});
      await rdfStore.putStream(req.pipe(parserStream));
      res.status(200).end();
    });
  }

};

module.exports = importController;
