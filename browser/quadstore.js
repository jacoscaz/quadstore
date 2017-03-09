
'use strict';

const leveljs = require('level-js');
const QuadStore = require('..').QuadStore;

module.exports = new QuadStore('quadstore', { db: leveljs });
