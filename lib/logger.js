'use strict';

const pino = require('pino');

const logger = pino({
  level: 'trace',
  serializers: pino.stdSerializers
});

module.exports = logger;
