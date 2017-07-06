
'use strict';

const leveljs = require('level-js');
const quadstore = require('..');

module.exports.leveljs = leveljs;
module.exports.RdfStore = quadstore.RdfStore;
module.exports.QuadStore = quadstore.QuadStore;
