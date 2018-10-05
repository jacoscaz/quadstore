
'use strict';

const leveljs = require('level-js');
const quadstore = require('./');
const dataFactory = require('@rdfjs/data-model');

quadstore.leveljs = leveljs;
quadstore.dataFactory = dataFactory;

module.exports = quadstore;
