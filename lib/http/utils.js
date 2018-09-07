
'use strict';

function asyncMiddleware(fn) {
  return (function (req, res, next) {
    fn.call(this, req, res, next)
      .catch(next);
  });
}

module.exports.asyncMiddleware = asyncMiddleware;
