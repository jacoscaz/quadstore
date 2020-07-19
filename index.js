
'use strict';

require('./lib/get');     // TODO: get rid of this - fixes circular dependency issue
require('./lib/search');  // TODO: get rid of this - fixes circular dependency issue

module.exports.RdfStore = require('./lib/rdfstore').default;
module.exports.QuadStore = require('./lib/quadstore').default;
