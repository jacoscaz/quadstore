
# QUADSTORE [![Build Status](https://travis-ci.org/beautifulinteractions/node-quadstore.svg?branch=master)](https://travis-ci.org/beautifulinteractions/node-quadstore)

![Logo](https://github.com/beautifulinteractions/node-quadstore/blob/master/logo.png?raw=true)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[![NPM](https://nodei.co/npm/quadstore.png)](https://nodei.co/npm/quadstore/)

A LevelDB-backed graph database for Node.js supporting quads, SPARQL queries and the RDF/JS interface.

## Table of contents

- [Introduction](#introduction)
- [Status](#status)
    - [Roadmap](#roadmap)
    - [Changelog](#changelog)
    - [Current version and features](#current-version-and-features)
    - [Notes](#notes)
- [Usage](#usage)
    - [Storage](#storage-backends)
    - [Graph Interface](#graph-api)
        - [QuadStore class](#quadstore-class)
        - [QuadStore.prototype.get](#quadstoreprototypeget)
        - [QuadStore.prototype.getByIndex](#quadstoreprototypegetbyindex)
        - [QuadStore.prototype.put](#quadstoreprototypeput)
        - [QuadStore.prototype.del](#quadstoreprototypedel)
        - [QuadStore.prototype.patch](#quadstoreprototypepatch)
        - [QuadStore.prototype.getStream](#quadstoreprototypegetstream)
        - [QuadStore.prototype.getByIndexStream](#quadstoreprototypegetbyindexstream)
        - [QuadStore.prototype.putStream](#quadstoreprototypeputstream)
        - [QuadStore.prototype.delStream](#quadstoreprototypedelstream)
        - [QuadStore.prototype.registerIndex](#quadstoreprototyperegisterindex)
    - [RDF Interface](#rdf-interface)
        - [RdfStore class](#rdfstore-class)
        - [Graph API, Quad and Term instances](#graph-api-quad-and-term-instances)
        - [RdfStore.prototype.match](#rdfstoreprototypematch)
        - [RdfStore.prototype.sparql](#rdfstoreprototypesparql)
        - [RdfStore.prototype.import](#rdfstoreprototypeimport)
        - [RdfStore.prototype.remove](#rdfstoreprototyperemove)
        - [RdfStore.prototype.removeMatches](#rdfstoreprototyperemovematches)
        - [RdfStore HTTP API](#rdfstore-http-api)
            - [GET /match](#get-match)
            - [POST /import](#post-import)
            - [POST /remove](#post-remove)
            - [GET /ldf](#get-ldf)
            - [GET,POST /sparql](#getpost-sparql)
- [Browser](#browser)
- [Performance](#performance)
- [License](#license)

## Introduction ##

A quad is a triple with an added `graph` term.

    (subject, predicate, object, graph)

Such additional term facilitates the representation of metadata, such as 
provenance, in the form of other quads having the `graph` of the former 
quads as their subject or object.

Quadstore heavily borrows from LevelGraph's approach to storing tuples but 
employs a different indexing strategy that requires the same number of indexes
to handle the additional dimension and efficiently store and query quads.

LevelGraph's approach to storing tuples is described in this presentation
[How to Cook a Graph Database in a Night](http://nodejsconfit.levelgraph.io/)
by LevelGraph's creator Matteo Collina.

Quadstore's indexing strategy has been developed by 
[Sarra Abbassi](mailto:abbassy.sarra@gmail.com) and 
[Rim Faiz](mailto:rim.faiz@ihec.rnu.tn) and is described in the paper
[RDF-4X: a scalable solution for RDF quads store in the cloud](http://dl.acm.org/citation.cfm?id=3012104).

## Status ##

Unstable, active, under development.

### Roadmap

See [ROADMAP.md](./ROADMAP.md).

### Changelog

See [CHANGELOG.md](./CHANGELOG.md).

### Current version and features

Current version: **v4.0.1** [[See on NPM](https://www.npmjs.com/package/quadstore)].

- Supports retrieval, update, insertion and removal of quads
- Supports both Promise(s) and callbacks
- Supports `SPARQL` queries
- Implements [RDF/JS](https://github.com/rdfjs/representation-task-force)' `Store`, `Source` and `Sink` interfaces
- Exposes `HTTP` endpoints mirroring the features of `RDF/JS`' interfaces
- Exposes a [Triple Pattern Fragments](https://www.hydra-cg.com/spec/latest/triple-pattern-fragments/) `HTTP` endpoint
- Exposes a [SPARQL 1.1 Protocol](https://www.w3.org/TR/2013/REC-sparql11-protocol-20130321/) `HTTP` endpoint

### Notes

- Uses [Semantic Versioning](https://www.npmjs.com/package/quadstore). 
  Pre-releases are tagged accordingly.
- The `master` branch is kept in sync with NPM and all development work happens
  on the `devel` branch and/or issue-specific branches.
- Requires Node.js >= 8.0.0.

## Usage ##

### Storage

`quadstore` uses the [LevelUP](https://github.com/level/levelup) package to 
interface with any [LevelDB](http://leveldb.org)-compatible storage backend.

We test `quadstore` using the following backends:

- `leveldown` - The [LevelDOWN](https://github.com/level/leveldown/) package 
  offers persistent storage backed by LevelDB itself.
- `memdown` - The [MemDOWN](https://github.com/level/memdown) package offers
  volatile in-memory storage.

### Graph API

#### QuadStore class

    const QuadStore = require('quadstore').QuadStore;
    const store = new QuadStore(abstractLevelDOWN, opts);

Instantiates a new store. The `abstractLevelDOWN` argument **must** be an 
instance of a leveldb backend. Supported properties for the `opts` argument 
are:

    opts.contextKey = 'graph';        // Name of fourth term

The `contextKey` option determines which key the store will use to read and
write the fourth term of each quad. The default value `graph` requires all 
quads to be formatted as `{ subject, predicate, object, graph }` objects. 
Similarly, the value `context` would require all quads to be formatted as
`{ subject, predicate, object, context }` objects.

#### QuadStore.prototype.get()

    const matchTerms = {graph: 'g'};

    store.get(matchTerms, (getErr, matchingQuads) => {}); // callback
    store.get(matchTerms).then((matchingQuads) => {}); // promise

Returns an array of all quads within the store matching the specified terms.

#### QuadStore.prototype.getByIndex()

    const name = 'index';
    const opts = {gte: 'subject1', lte: 'subject42'};

    store.getByIndex(name, opts, (getErr, matchingQuads) => {}); // callback
    store.getByIndex(name, opts).then((matchingQuads) => {}); // promise

Returns an array of all quads within the store matching the specified 
conditions as tested against the specified index. Options available are `lt`,
`lte`, `gt`, `gte`, `limit`, `reverse`.

For standard prefix-matching queries, append the boundary character 
`store.boundary` to the `lte` value:

    { gte: 's', lte: 's' + store.boundary }

#### QuadStore.prototype.put()

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'g'}
    ];

    store.put(quads, (putErr) => {}); // callback
    store.put(quads).then(() => {}); // promise

Stores new quads. Does *not* throw or return an error if quads already exists.

#### QuadStore.prototype.del()

This method deletes quads. It Does *not* throw or return an error if the 
specified quads are not present in the store.

If the first argument is a quad or an array of quads, this method will delete 
such quads from the store.

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'g'}
    ];

    store.del(quads, (delErr) => {}); // callback
    store.del(quads).then(() => {}); // promise

If the first argument is a set of matching terms, this method will delete all 
quads matching such terms from the store.

    const matchTerms = {graph: 'g'};

    store.del(matchTerms, (delErr) => {}); // callback
    store.del(matchTerms).then(() => {}); // promise

#### QuadStore.prototype.patch()

This methods deletes and inserts quads in a single operation. It Does *not* 
throw or return an error if the specified quads are not present in the store 
(delete) or already present in the store (update).

If the first argument is a single quad or an array of quads, it is assumed to 
be an array of quads to be deleted.

    const oldQuads = [
        {subject: 'so', predicate: 'po', object: 'oo', graph: 'go'}
    ];

    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', graph: 'gn'}
    ];

    store.patch(oldQuads, newQUads, (delputErr) => {}); // callback
    store.patch(oldQuads, newQUads).then(() => {}); // promise

If the first argument is a set of matching terms, this method will delete all 
quads matching such terms from the store.

    const matchTerms = {subject: 'so', graph: 'go'}

    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', graph: 'gn'}
    ];

    store.patch(matchTerms, newQuads, (delputErr) => {}); // callback
    store.patch(matchTerms, newQuads).then(() => {}); // promise

#### QuadStore.prototype.getStream()

    const matchTerms = {graph: 'c'};

    const readableStream = store.getStream(matchTerms);

*Synchronously* returns a `stream.Readable` of all quads matching the terms in 
the specified query.

#### QuadStore.prototype.getByIndexStream()

    const name = 'index';
    const opts = {gte: 'subject1', lte: 'subject42'};

    const readableStream = store.getStream(name, opts);

*Synchronously* returns a `stream.Readable` of all quads within the store 
matching the specified conditions as tested against the specified index. 
Options available are `lt`,`lte`, `gt`, `gte`, `limit`, `reverse`.

For standard prefix-matching queries, append the boundary character 
`store.boundary` to the `lte` value:

    { gte: 's', lte: 's' + store.boundary }

#### QuadStore.prototype.putStream()

    store.putStream(readableStream, (err) => {});
    store.putStream(readableStream).then(() => {});

Imports all quads coming through the specified `stream.Readable` into the store.

#### QuadStore.prototype.delStream()

    store.delStream(readableStream, (err) => {});
    store.delStream(readableStream).then(() => {});

Deletes all quads coming through the specified `stream.Readable` from the store.

#### QuadStore.prototype.registerIndex()

    store.registerIndex('updatedAt', function (quad) {
      return quad.subject.split('').reverse().join('');
    });

Creates a new index that uses the provided function to compute index keys.

### RDF Interface

`quadstore` aims to support the 
[RDF/JS](https://github.com/rdfjs/representation-task-force) interface 
specification through the specialized `RdfStore` class, which currently 
implements the `Source`, `Sink` and `Store` interfaces (Term(s)-only, no 
RegExp(s)).

Additionally, the `RdfStore` class also supports `SPARQL` queries and provides
`HTTP` endpoints matching the 
[RDF/JS](https://github.com/rdfjs/representation-task-force)'s specification.

#### RdfStore class

    const RdfStore = require('quadstore').RdfStore;
    const store = new RdfStore(abstractLevelDOWN, opts);

Instantiates a new store. The `RdfStore` class extends `QuadStore` and requires
an instance of a leveldb backend as the `abstractLevelDOWN` argument. In 
addition to all options supported by `QuadStore`, `RdfStore` supports the 
following:

    opts.dataFactory = require('@rdf-data-model'); // RDFJS dataFactory implementation
    opts.httpPort = 8080;                         // Listening port
    opts.httpAddr = '127.0.0.1'                   // Listening address
    opts.httpBaseUrl = 'http://127.0.0.1:8080';   // Base url for the http server

The `dataFactory` option, if specified, *must* be an implementation of the
`dataFactory` interface defined in the RDF/JS specification, such as: 

- [@rdfjs/data-model](https://www.npmjs.com/package/@rdfjs/data-model)
- [N3.js' N3.DataFactory](https://www.npmjs.com/package/n3)

The `contextKey` option from the `QuadStore` class is set to `graph` and cannot
be changed.

The `httpAddr` and `httpPort` options specify the address and port that the
internal `HTTP` server should listen to.

The `httpBaseUrl` option is used by the internal `HTTP` server to render URLs
correctly.

#### Graph API, Quad and Term instances

The `RdfStore` class extends the `QuadStore` class. Instead of plain objects, 
the `get`, `put`, `del`, `patch`, `query`, `getStream`, `putStream` and 
`delStream` methods accept and return (streams of and/or arrays of) `Quad` 
objects as produced by the `dataFactory.quad` method. 

Matching terms, such as those used in the `query`, `get` and `createReadStream`
methods, must be `Term` objects as produced by the `dataFactory.namedNode`, 
`dataFactory.blankNode` or `dataFactory.literal` methods. 

The same rules apply for the `match`, `import`, `remove` and `removeMatches` 
methods inherited from the RDF/JS interface.

The conditions used in `getByIndex()`, `getByIndexStream()` and the key 
generation function used in `registerIndex()` **must** use the serialization 
format of [Ruben Verborgh's `N3` library](https://www.npmjs.com/package/n3).

#### RdfStore.prototype.match()

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');

    store.match(subject, null, null, graph)
      .on('error', (err) => {})
      .on('data', (quad) => {
        // Quad is produced using dataFactory.quad()
      })
      .on('end', () => {});

Returns a `stream.Readable` of RDF/JS `Quad` instances matching the provided terms.

#### RdfStore.prototype.sparql()

    const query = 'SELECT *  WHERE { GRAPH ?g { ?s ?p ?o } }';
    const resultsStream = await store.sparql(query, 'application/sparql-results+xml);
    resultsStream.on('data', (chunk) => { /* ... */ });

Returns a `stream.Readable` that outputs the results of the query, formatted
according to the data format specified as the second argument. 

| Format                            | Datatype of emitted chunks                                  |
| --------------------------------- | ----------------------------------------------------------- |
| *nil*                             | dictionary of bindings as RDF/JS' `Term` instances          |
| `comunica`                        | `@comunica/actor-init-sparql-rdfjs`' `result` object        |     
| `application/json`                | simple JSON serialization                                   |
| `application/sparql-results+xml`  | [SPARQL-XML](https://www.w3.org/TR/rdf-sparql-XMLres/)      |
| `application/sparql-results+json` | [SPARQL-JSON](https://www.w3.org/TR/sparql11-results-json/) |
| `application/trig`                | [Trig](https://www.w3.org/TR/trig/)                         |
| `application/n-quads`             | [N-Quads](https://www.w3.org/TR/n-quads/)                   |

RdfStore's SPARQL capabilities are powered by the 
[Comunica](https://github.com/comunica/comunica) query engine platform. 

#### RdfStore.prototype.import()

    const readableStream; // A stream.Readable of Quad() instances

    store.import(readableStream)
      .on('error', (err) => {})
      .on('end', () => {});

Consumes the stream storing each incoming quad.

#### RdfStore.prototype.remove()

    const readableStream; // A stream.Readable of Quad() instances

    store.remove(readableStream)
      .on('error', (err) => {})
      .on('end', () => {});

Consumes the stream removing each incoming quad.

#### RdfStore.prototype.removeMatches()

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');

    store.removeMatches(subject, null, null, graph)
      .on('error', (err) => {})
      .on('end', () => {});

Removes all quad  matching the provided terms.

### RdfStore HTTP API

The following endpoints are made avaible by the internal `HTTP` server:

#### `GET /match`

Mirrors `RDF/JS`'s `Source.match()` method. Returns quads serialized either in 
`application/n-quads` or `application/trig` matching the specified query 
parameters. 

Supported parameters are `subject`, `predicate`, `object`, `graph`, `offset` 
and `limit`.

    GET http://127.0.0.1:8080/match?subject=<value>&offset=10&limit=10
    
Values for the `subject`, `predicate`, `object` and `graph` parameters **must**
be serialized using 
[Ruben Verborgh's `N3` library](https://www.npmjs.com/package/n3) and **must** 
be urlencoded.

#### `POST /import`

Mirrors `RDF/JS`'s `Sink.import()` method. Accepts a payload of quads serialized 
either in `application/n-quads` or `application/trig` and imports them into 
the store.

    POST http://127.0.0.1:8080/import
 
#### `POST /delete`

Mirrors `RDF/JS`'s `Store.delete()` method. Accepts a payload of quads 
serialized either in `application/n-quads` or `application/trig` and deletes 
them from the store.

    POST http://127.0.0.1:8080/delete

#### `GET /ldf`

Provides a [Linked Data Fragments](http://linkeddatafragments.org/) endpoint 
implementing the 
[Triple Pattern Fragments](https://www.hydra-cg.com/spec/latest/triple-pattern-fragments/)
(TPF) interface for use with suitable clients.

    GET http://127.0.0.1:8080/ldf?page=2
    
In order to support quads instead of triples, this endpoint is tested using 
[our own fork](https://github.com/beautifulinteractions/Client.js/tree/bi)
of the [Client.js](https://github.com/LinkedDataFragments/Client.js) library.
The fork tracks the `feature-qpf-latest` branch of the upstream repository
and merges in fixes from other branches. We will switch to the NPM version of 
Client.js (`ldf-client`) in the near future.

#### `GET,POST /sparql`

Provides a [SPARQL 1.1 Protocol](https://www.w3.org/TR/2013/REC-sparql11-protocol-20130321/)
endpoint be used with suitable clients.

### Browser

Browser use is currently not supported but being tracked in 
[issue #4](https://github.com/beautifulinteractions/node-quadstore/issues/4)
and could use some help from interested parties.

## Performance

We've yet to develop proper benchmarks. That said, loading the `21million.rdf`
file into an instance of `RdfStore` on Node v8.4.0 running on a late 2013 
MacBook Pro (Intel Core i5 2.4 Ghz, SSD storage) clocks at **~9.5k quads per 
second** and and **~4.3k quads per MB**. See [loadfile.js](https://github.com/beautifulinteractions/node-quadstore/blob/master/perf/loadfile.js).
 

## LICENSE

See [LICENSE.md](./LICENSE.md).
