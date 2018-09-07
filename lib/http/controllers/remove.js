
'use strict';

const n3 = require('n3');
const httpUtils = require('../utils');

const removeController = {

  createHandler(rdfStore) {
    return httpUtils.asyncMiddleware(async (req, res) => {
      const parserStream = new n3.StreamParser({format: req.get('content-type')});
      await rdfStore.delStream(req.pipe(parserStream));
      res.status(200).end();
    });
  }

};

module.exports = removeController;
