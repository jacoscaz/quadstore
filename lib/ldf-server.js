
'use strict';

const _ = require('lodash');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const stream = require('stream');

/*
 * INTRODUCTION
 *
 * This module refactors the initialization logic from ldf-server/bin/ldf-server.js
 * into a function that instantiates a ldf-server exposing the contents of a
 * RdfStore instance through a custom implementation of the Datasource interface.
 */

/*
 * LDF-SERVER PACKAGE LOADER
 *
 * This function loads the ldf-server package and exports refactored versions of the
 * functions contained in ldf-server/bin/ldf-server.js. The refactoring takes care
 * of the fact that those functions resolve paths to other modules of the ldf-server
 * package using __dirname.
 */

function requireLdfServerModule() {
  try {
    return {
      exports: require('ldf-server'),
      path: path.join(path.dirname(require.resolve('ldf-server')), 'bin'),
      defaults: require('ldf-server/config/config-defaults.json'),
      constructors: {},
      instantiate(description, includePath, config) {
        const mod = this;
        const type = description.type || description;
        const typePath = path.join(includePath ? path.resolve(mod.path, includePath) : '', type);
        const Constructor = mod.constructors[typePath] || (mod.constructors[typePath] = require(typePath));
        const extensions = config.extensions && config.extensions[type] || [];
        const settings = _.defaults(description.settings || {}, {
          extensions: extensions.map(function (x) { return mod.instantiate(x, includePath, config); }),
        }, config);
        return new Constructor(settings, config);
      },
      instantiateWithConstructor(description, Constructor, config) {
        const mod = this;
        const settings = _.defaults(description.settings || {}, config);
        return new Constructor(settings, config);
      },
      instantiateAll(descriptions, includePath, config) {
        const mod = this;
        return (_.isArray(descriptions) ? _.map : _.mapValues)(descriptions, function (description) {
          return mod.instantiate(description, includePath, config);
        });
      },
      findFiles(folder, pattern, includeCurrentFolder) {
        const mod = this;
        folder = path.resolve(mod.path, folder);
        return _.flatten(_.compact(fs.readdirSync(folder).map(function (name) {
          name = path.join(folder, name);
          if (fs.statSync(name).isDirectory())
            return mod.findFiles(name, pattern, true);
          else if (includeCurrentFolder && pattern.test(name))
            return name;
        })));
      }
    };
  } catch (requireErr) {
    const wrappedErr = new Error('FATAL: Could not require module "ldf-server".');
    wrappedErr.stack = wrappedErr.stack + '\nCaused by: ' + wrappedErr.stack + '\n\n';
    throw wrappedErr;
  }
}

/*
 * FACTORY FOR A CUSTOM DATASOURCE IMPLEMENTATION
 *
 * This function returns a constructor for a class that extends the generic
 * Datasource class of the ldf-server package as loaded via the loader function
 * above. This implementation of the Datasource class exposes the contents of
 * an instance of RdfStore to its ldf-server.
 */

function createCountStream() {
  const cs = new stream.Transform({
    objectMode: true,
    transform(quad, enc, cb) {
      this.count += 1;
      this.push(quad);
      cb();
    }
  });
  cs.count = 0;
  return cs;
}

function makeRdfStoreDataSourceClass(ldfServerModule) {
  const DataSource = ldfServerModule.exports.datasources.Datasource;
  function RdfStoreDataSource(opts) {
    DataSource.call(this, opts);
    this._rdfStore = opts.rdfStore;
  }
  DataSource.extend(RdfStoreDataSource, ['triplePattern', 'limit', 'offset', 'totalCount']);
  RdfStoreDataSource.prototype._executeQuery = function (query, destination) {
    const getTerms = {
      subject: query.subject ? this._rdfStore._exportTerm(query.subject) : null,
      predicate: query.predicate ? this._rdfStore._exportTerm(query.predicate) : null,
      object: query.object ? this._rdfStore._exportTerm(query.object) : null,
      graph: query.graph ? this._rdfStore._exportTerm(query.graph) : null,
    };
    this._rdfStore.getApproximateSize(getTerms, (sizeErr, estimatedTotalCount) => {
      if (sizeErr) {
        destination.emit('error', sizeErr);
        return;
      }
      const getOpts = { offset: query.offset || 0, limit: query.limit || Infinity };
      const getStream = this._rdfStore.getSerializedValuesStream(getTerms, getOpts);
      const countStream = createCountStream();
      destination.source = getStream.pipe(countStream);
      countStream.on('finish', () => {
        const count = countStream.count;
        if (count && estimatedTotalCount < getOpts.offset + count) {
          estimatedTotalCount = getOpts.offset + (count < query.limit ? count : 2 * count);
        }
        destination.setProperty('metadata', { totalCount: estimatedTotalCount, hasExactCount: false });
      });
    });
    // This requires https://github.com/LinkedDataFragments/Server.js/pull/56
    // destination.source = this._rdfStore.getSerializedValuesStream(storeTerms, queryOpts);
  };
  return RdfStoreDataSource;
}

/*
 * LDF SERVER CONSTRUCTOR
 *
 * This function implements the init logic in ldf-server/bin/ldf-server.js and returns
 * an instance of a ldf server that exposes the data contained in the provided rdfStore.
 */


function LdfServer(rdfStore, opts) {

  if (!opts) opts = {};

  // Logger

  const logger = opts.logger || require('./logger').child({
    name: 'ldf-server',
    level: opts.logLevel || 'info'
  });

  // Load the ldf-server package

  const ldfServerModule = requireLdfServerModule({ logger });

  const ViewCollection = ldfServerModule.exports.views.ViewCollection;
  const IndexDatasource = ldfServerModule.exports.datasources.IndexDatasource;
  const LinkedDataFragmentsServer = ldfServerModule.exports.LinkedDataFragmentsServer;

  // Create the constructor for the custom datasource implementation

  const RdfStoreDataSource = makeRdfStoreDataSourceClass(ldfServerModule);

  // Default config for the ldf-server

  const ldfServerConfig = _.defaults({
    "title": "My Linked Data Fragments server",
    "protocol": "http",
    "datasources": {}
  }, ldfServerModule.defaults);

  // Some helpful vars

  const baseURL = ldfServerConfig.baseURL = ldfServerConfig.baseURL.replace(/\/?$/, '/');
  const baseURLRoot = baseURL.match(/^(?:https?:\/\/[^\/]+)?/)[0];
  const baseURLPath = baseURL.substr(baseURLRoot.length);
  const blankNodePath = baseURLRoot ? '/.well-known/genid/' : '';
  const blankNodePrefix = blankNodePath ? baseURLRoot + blankNodePath : 'genid:';
  const datasourceBase = baseURLPath.substr(1);

  // I still have to look into what this does

  const dereference = ldfServerConfig.dereference;

  // Datasources

  const datasources = ldfServerConfig.datasources;

  // Configuration of the custom datasource

  const rdfStoreDataSourceName = 'rdfstore';
  const rdfStoreDatasourceConfig = {}; // config.datasources[datasourceName];
  const rdfStoreDatasourcePath = datasourceBase + encodeURI(rdfStoreDataSourceName);

  rdfStoreDatasourceConfig.url = baseURLRoot + '/' + rdfStoreDatasourcePath + '#dataset';
  rdfStoreDatasourceConfig.title = rdfStoreDatasourceConfig.title || rdfStoreDataSourceName;

  rdfStoreDatasourceConfig.settings = _.defaults(rdfStoreDatasourceConfig.settings || {}, ldfServerConfig);

  if (!rdfStoreDatasourceConfig.settings.blankNodePrefix) {
    rdfStoreDatasourceConfig.settings.blankNodePrefix = blankNodePrefix + rdfStoreDatasourcePath + '/';
    if (blankNodePath)
      dereference[blankNodePath + rdfStoreDatasourcePath + '/'] = rdfStoreDatasourcePath;
  }

  rdfStoreDatasourceConfig.settings.rdfStore = rdfStore;

  // Instantiation of the custom datasource

  rdfStoreDatasourceConfig.datasource = ldfServerModule.instantiateWithConstructor(rdfStoreDatasourceConfig, RdfStoreDataSource, '../lib/datasources/', ldfServerConfig);;

  // Registration of the custom datasource

  datasources[rdfStoreDatasourcePath] = rdfStoreDatasourceConfig;

  // Initialization of the index datasource

  const indexPath = datasourceBase.replace(/\/$/, '');
  datasources[indexPath] = datasources[indexPath] || {
    url: baseURLRoot + '/' + indexPath + '#dataset',
    role: 'index',
    title: 'dataset index',
    datasource: new IndexDatasource({ datasources }),
  };

  // Set up assets

  ldfServerConfig.assetsPath = baseURLPath + 'assets/';

  // Set up routers, views, and controllers

  ldfServerConfig.routers = ldfServerModule.instantiateAll(ldfServerConfig.routers,  '../lib/routers/', ldfServerConfig);
  ldfServerConfig.views = new ViewCollection();
  ldfServerConfig.views.addViews(ldfServerModule.instantiateAll(ldfServerModule.findFiles('../lib/views', /\.js$/), null, ldfServerConfig));
  ldfServerConfig.controllers = ldfServerModule.instantiateAll(ldfServerConfig.controllers, '../lib/controllers/', ldfServerConfig);

  // Set up logging

  ldfServerConfig.accesslogger = function (req, res) {
    const now = Date.now();
    res.on('finish', () => {
      const then = Date.now();
      logger.info('%s %s (%sms)', req.method, req.url, then - now);
    });
  };

  ldfServerConfig.log = () => {};

  // Instantiation of the ldf-server instance

  return new LinkedDataFragmentsServer(ldfServerConfig);
}

module.exports = LdfServer;
