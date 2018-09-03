
'use strict';

function asyncMiddleware(fn) {
  return ((req, res, next) => {
    fn.call(this, req, res, next)
      .catch(next);
  });
}

module.exports.asyncMiddleware = asyncMiddleware;
