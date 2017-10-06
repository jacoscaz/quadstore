
const _ = require('lodash');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const debug = require('debug')('quadstore:ldf');
const stream = require('stream');
const shortid = require('shortid');
const asynciterator = require('asynciterator');

/*
 * LDF SERVER MODULE
 */

// Try to require the module

let ldfServer;
let ldfServerPath;
let ldfServerDefaults;

try {
  ldfServer = require('ldf-server');
  ldfServerPath = path.join(path.dirname(require.resolve('ldf-server')), 'bin');
  ldfServerDefaults = require('ldf-server/config/config-defaults.json');
} catch(err) {
  console.error('\n\nCould not require module "ldf-server".\n\n');
  process.exit(1);
}

debug('ldf-server module path:', ldfServerPath);
debug('ldf-server default config:', ldfServerDefaults);

/*
 * UTILITY FUNCTIONS
 */

// Instantiates an object from the given description

const constructors = {};

function instantiate(description, includePath, config) {
  var type = description.type || description,
    typePath = path.join(includePath ? path.resolve(ldfServerPath, includePath) : '', type),
    Constructor = constructors[typePath] || (constructors[typePath] = require(typePath)),
    extensions = config.extensions && config.extensions[type] || [],
    settings = _.defaults(description.settings || {}, {
      extensions: extensions.map(function (x) { return instantiate(x, includePath, config); }),
    }, config);
  return new Constructor(settings, config);
}

function _instantiate(description, Constructor, includePath, config) {
  // var type = description.type || description,
  //   typePath = path.join(includePath ? path.resolve(ldfServerPath, includePath) : '', type),
  //   Constructor = constructors[typePath] || (constructors[typePath] = require(typePath)),
  const extensions = []; // config.extensions && config.extensions[type] || [];
  const settings = _.defaults(description.settings || {}, {
    extensions: extensions.map(function (x) { return instantiate(x, includePath, config); })
  }, config);
  settings.rdfStore = description.rdfStore;
  return new Constructor(settings, config);
}

// Instantiates all objects from the given descriptions

function instantiateAll(descriptions, includePath, config) {
  return (_.isArray(descriptions) ? _.map : _.mapValues)(descriptions,
    function (description) { return instantiate(description, includePath, config); });
}

// Recursively finds files in a folder whose name matches the pattern

function findFiles(folder, pattern, includeCurrentFolder) {
  folder = path.resolve(ldfServerPath, folder);
  return _.flatten(_.compact(fs.readdirSync(folder).map(function (name) {
    name = path.join(folder, name);
    if (fs.statSync(name).isDirectory())
      return findFiles(name, pattern, true);
    else if (includeCurrentFolder && pattern.test(name))
      return name;
  })));
}

/*
 * CUSTOM DATASOURCE
 */

class ExporterStream extends stream.Transform {

  constructor() {
    super({ objectMode: true });
  }

  _transform(quad, enc, cb) {
    this.push({
      subject: quad.subject._serializedValue,
      predicate: quad.predicate._serializedValue,
      object: quad.object._serializedValue,
      graph: quad.graph._serializedValue
    });
    cb();
  }

}

const DataSource = ldfServer.datasources.Datasource;

function RdfStoreDataSource(opts) {
  debug(opts);
  DataSource.call(this, opts);
  this._rdfStore = opts.rdfStore;
  debug('new RdfStoreDataSource()');
}

DataSource.extend(RdfStoreDataSource, ['triplePattern', 'limit', 'offset', 'totalCount']);

RdfStoreDataSource.prototype._executeQuery = function (query, destination) {
  debug('_executeQuery()');
  const matchTerms = {
    subject: query.subject ? this._rdfStore._exportTerm(query.subject) : null,
    predicate: query.predicate ? this._rdfStore._exportTerm(query.predicate) : null,
    object: query.object ? this._rdfStore._exportTerm(query.object) : null,
    graph: query.graph ? this._rdfStore._exportTerm(query.graph) : null,
  };
  debug('Terms:', matchTerms);
  const queryOpts = { offset: query.offset, limit: query.limit };
  this._rdfStore.getApproximateSize(matchTerms, queryOpts, (sizeErr, size) => {
    if (sizeErr) {
      destination.emit('error', sizeErr);
      return;
    }
    destination.setProperty('metadata', { totalCount: size, hasExactCount: false });
  });
  // THIS REQUIRES https://github.com/LinkedDataFragments/Server.js/pull/56
  // JUST EDIT THOSE LINES BY HAND FOR THE TIME BEING
  const quadStream = this._rdfStore.getStream(matchTerms, queryOpts)
    .pipe(new ExporterStream());
  destination.source = quadStream;
};

/*
 * LDF SERVER INIT
 */


function initLdfServer(rdfStore) {

  const ViewCollection = ldfServer.views.ViewCollection;
  const IndexDatasource = ldfServer.datasources.IndexDatasource;
  const LinkedDataFragmentsServer = ldfServer.LinkedDataFragmentsServer;

  // Configuration

  const config = _.defaults({
    "title": "My Linked Data Fragments server",
    "protocol": "http",
    "datasources": {}
  }, ldfServerDefaults);

  // Vars

  const baseURL = config.baseURL = config.baseURL.replace(/\/?$/, '/');
  const baseURLRoot = baseURL.match(/^(?:https?:\/\/[^\/]+)?/)[0];
  const baseURLPath = baseURL.substr(baseURLRoot.length);
  const blankNodePath = baseURLRoot ? '/.well-known/genid/' : '';
  const blankNodePrefix = blankNodePath ? baseURLRoot + blankNodePath : 'genid:';

  const datasources = config.datasources;
  const datasourceBase = baseURLPath.substr(1);
  const dereference = config.dereference;

  const datasourceName = 'rdfstore';
  const datasourceConfig = {}; // config.datasources[datasourceName];
  const datasourcePath = datasourceBase + encodeURI(datasourceName);

  // Set up blank-node-to-IRI translation, with dereferenceable URLs when possible

  datasourceConfig.settings = _.defaults(datasourceConfig.settings || {}, config);
  if (!datasourceConfig.settings.blankNodePrefix) {
    datasourceConfig.settings.blankNodePrefix = blankNodePrefix + datasourcePath + '/';
    if (blankNodePath)
      dereference[blankNodePath + datasourcePath + '/'] = datasourcePath;
  }

  // Pass the rdfStore instance!

  datasourceConfig.rdfStore = rdfStore;

  // Instantiate the datasource

  const datasource = _instantiate(datasourceConfig, RdfStoreDataSource, '../lib/datasources/', config);


  // datasource.on('error', datasourceError);
  datasourceConfig.datasource = datasource;
  datasourceConfig.url = baseURLRoot + '/' + datasourcePath + '#dataset';
  datasourceConfig.title = datasourceConfig.title || datasourceName;

  // Register datasource

  datasources[datasourcePath] = datasourceConfig;

  // Create index data source

  const indexPath = datasourceBase.replace(/\/$/, '');
  datasources[indexPath] = datasources[indexPath] || {
    url: baseURLRoot + '/' + indexPath + '#dataset',
    role: 'index',
    title: 'dataset index',
    datasource: new IndexDatasource({ datasources }),
  };

  // Set up assets

  config.assetsPath = baseURLPath + 'assets/';

  // Set up routers, views, and controllers

  config.routers = instantiateAll(config.routers,  '../lib/routers/', config);
  config.views = new ViewCollection();
  config.views.addViews(instantiateAll(findFiles('../lib/views', /\.js$/), null, config));
  config.controllers = instantiateAll(config.controllers, '../lib/controllers/', config);

  // Set up logging

  const loggingSettings = _.defaults(config.logging, ldfServerDefaults.logging);
  config.log = console.log;
  if (true || loggingSettings.enabled) {
    const accesslog = require('access-log');
    config.accesslogger = function (request, response) {
      accesslog(request, response, null, function (logEntry) {
        fs.appendFile(loggingSettings.file, logEntry + '\n', function (error) {
          error && process.stderr.write('Error when writing to access log file: ' + error);
        });
      });
    };
  }

  // Instantiate server

  const server = new LinkedDataFragmentsServer(config);

  // Done!

  return server;

}

module.exports.initLdfServer = initLdfServer;
