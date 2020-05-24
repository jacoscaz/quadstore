
'use strict';

require('./lib/get');     // TODO: get rid of this - fixes circular dependency issue
require('./lib/search');  // TODO: get rid of this - fixes circular dependency issue

const RdfStore = require('./lib/rdfstore');
const QuadStore = require('./lib/quadstore');

module.exports = QuadStore;
module.exports.RdfStore = RdfStore;
module.exports.QuadStore = QuadStore;
