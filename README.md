

# QUADSTORE [![Build Status](https://travis-ci.org/beautifulinteractions/node-quadstore.svg?branch=master)](https://travis-ci.org/beautifulinteractions/node-quadstore)

![Logo](https://github.com/beautifulinteractions/node-quadstore/blob/master/logo.png?raw=true)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[![NPM](https://nodei.co/npm/quadstore.png)](https://nodei.co/npm/quadstore/)

A LevelDB-backed graph database for Node.js and the browser. 
Supports quads, RDF/JS interfaces and SPARQL queries.

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
        - [QuadStore.prototype.put](#quadstoreprototypeput)
        - [QuadStore.prototype.del](#quadstoreprototypedel)
        - [QuadStore.prototype.patch](#quadstoreprototypepatch)
        - [QuadStore.prototype.getStream](#quadstoreprototypegetstream)
        - [QuadStore.prototype.putStream](#quadstoreprototypeputstream)
        - [QuadStore.prototype.delStream](#quadstoreprototypedelstream)
    - [RDF Interface](#rdf-interface)
        - [RdfStore class](#rdfstore-class)
        - [Graph API, Quad and Term instances](#graph-api-quad-and-term-instances)
        - [SPARQL queries](#sparqlqueries)
        - [RdfStore.prototype.match](#rdfstoreprototypematch)
        - [RdfStore.prototype.import](#rdfstoreprototypeimport)
        - [RdfStore.prototype.remove](#rdfstoreprototyperemove)
        - [RdfStore.prototype.removeMatches](#rdfstoreprototyperemovematches)
- [Browser](#browser)
- [Performance](#performance)
- [License](#license)

## Introduction

In the context of knowledge representation, a statement can often be 
represented as a 3-dimensional `(subject, predicate, object)` tuple,
normally referred to as a `triple`.

```
subject             predicate           object
BOB                 KNOWS               ALICE
BOB                 KNOWS               PAUL
```

A set of statements / triples can also be thought of as a graph:

```
                                        ┌────────┐
              KNOWS (predicate)         │ ALICE  │
     ┌─────────────────────────────────▶│(object)│
     │                                  └────────┘
┌─────────┐                                       
│   BOB   │                                       
│(subject)│                                       
└─────────┘                             ┌────────┐
     │                                  │  PAUL  │
     └─────────────────────────────────▶│(object)│
              KNOWS (predicate)         └────────┘
```                                                      

A `quad` is a triple with an additional term, usually called `graph` or
`context`.

    (subject, predicate, object, graph)

On a semantic level, the `graph` term identifies the graph to which a triple 
belongs. Each identifier can then be used as the `subject` or `object` of 
additional triples, facilitating the representation of metadata such as 
provenance and temporal validity. 

```
subject             predicate           object          graph
BOB                 KNOWS               ALICE           GRAPH-1
BOB                 KNOWS               PAUL            GRAPH-2
GRAPH-1             SOURCE              FACEBOOK
GRAPH-2             SOURCE              LINKEDIN
```

Quadstore is a LevelDB-backed graph database for Node.js and the browser 
with native support for quads and the RDF/JS interface specification.
Additional features, such as SPARQL queries, are made available through 
separate modules.

Quadstore heavily borrows from [LevelGraph's approach to storing tuples][i1],
maintaining multiple indexes each of which deals with a different permutation
of quad terms. In that sense, Quadstore is an alternative to [LevelGraph][i3] 
that strikes a different compromise between expressiveness and performance, 
opting to natively supporting quads while working towards minimizing 
[the performance penalty][i4] that comes with the fourth term. 

Whereas previous versions of Quadstore used to maintain a pre-defined set of 
indexes based on the paper [RDF-4X][i2], newer versions allow users to
configure custom set of indexes according to the usage and query patterns 
specific to each use case.

[i1]: http://nodejsconfit.levelgraph.io
[i2]: http://dl.acm.org/citation.cfm?id=3012104
[i3]: https://github.com/levelgraph/levelgraph
[i4]: https://github.com/levelgraph/levelgraph/issues/43#issuecomment-29519727

## Status

Active, under development.

### Roadmap

We're looking at the following features:

- Adding support for complex queries, see [searches in LevelGraph][r1]
- Adding support for quad generation, see [generation in LevelGraph][r2]
- Refactoring support for SPARQL queries around something lighter than Comunica

[r1]: https://github.com/levelgraph/levelgraph#searches
[r2]: https://github.com/levelgraph/levelgraph#triple-generation

### Changelog

See [CHANGELOG.md](./CHANGELOG.md).

### Current version and features

Current version: **v7.0.1** [[See on NPM](https://www.npmjs.com/package/quadstore)].

- Supports retrieval, update, insertion and removal of quads
- Supports both Promise(s) and callbacks
- Implements [RDF/JS](https://github.com/rdfjs/representation-task-force)' `Store`, `Source` and `Sink` interfaces
- SPARQL queries are supported via the additional [`quadstore-sparql`](https://github.com/beautifulinteractions/node-quadstore-sparql) package
- HTTP endpoints are supported via the additional [`quadstore-http`](https://github.com/beautifulinteractions/node-quadstore-http) package.

### Notes

- Uses [Semantic Versioning](https://semver.org). 
  Pre-releases are tagged accordingly.
- The `master` branch is kept in sync with NPM and all development work happens
  on the `devel` branch and/or issue-specific branches.
- Requires Node.js >= 10.0.0.

## Usage

### Storage

`quadstore` uses the [`levelup`](https://github.com/level/levelup) package to 
interface with any [LevelDB](http://leveldb.org)-compatible storage backend.

We test `quadstore` using the following backends:

- [`leveldown`](https://github.com/level/leveldown/) offers persistent storage
  backed by LevelDB itself
- [`memdown`](https://github.com/level/memdown) package offers volatile 
  in-memory storage

### Graph API

#### QuadStore class

    const QuadStore = require('quadstore').QuadStore;
    const store = new QuadStore(opts);

Instantiates a new store. Supported properties for the `opts` argument 
are:

    opts.backend = require('memdown')();    // REQUIRED: level instance 
    opts.contextKey = 'graph';              // OPTIONAL: name of fourth term
    opts.indexes = [                        // OPTIONAL: custom indexes
        ['subject', 'predicate', 'object', 'graph'],
    ];
    
The `opts.backend` option **must** be an instance of a leveldb backend.

The `opts.contextKey` option determines which key the store will use to read and
write the fourth term of each quad. The default value `graph` requires all 
quads to be formatted as `{ subject, predicate, object, graph }` objects. 
Similarly, the value `context` would require all quads to be formatted as
`{ subject, predicate, object, context }` objects.

##### Custom indexes

The `opts.indexes` option allows users to configure which indexes will be used
by the store. If not set, the store will default to the following indexes:

```
[
  ['subject', 'predicate', 'object', contextKey],
  ['object', contextKey, 'subject', 'predicate'],
  [contextKey, 'subject', 'predicate', 'object'],
  ['object', 'subject', 'predicate', contextKey],
  ['predicate', 'object', contextKey, 'subject'],
  [contextKey, 'predicate', 'object', 'subject'],
]; 
```

This option, if present, **must** be set to an array of terms array, each of 
which **must** represent one of the 24 possible permutations of the four terms 
`subject`, `predicate`, `object` and `[context]`. Partial indexes are not 
supported.

The store will automatically select which index(es) to use for a given query 
based on the available indexes and the query itself. **If no suitable index is
found for a given query, the store will throw an error**.

#### QuadStore.prototype.get()

    const matchTerms = {graph: 'g'};

    store.get(matchTerms, (getErr, matchingQuads) => {}); // callback
    store.get(matchTerms).then((matchingQuads) => {}); // promise

Returns an array of all quads within the store matching the specified terms.

##### Range matching

Quadstore supports range-based matching in addition to value-based matching. 
Ranges can be defined using the `gt`, `gte`, `lt`, `lte` properties: 

    const matchTerms = {graph: { gt: 'g' } };

    store.get(matchTerms, (getErr, matchingQuads) => {}); // callback
    store.get(matchTerms).then((matchingQuads) => {}); // promise


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
    
In the latter case, this method supports [range matching](#range-matching). 
See [QuadStore.prototype.get()](#quadstoreprototypeget).

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

In the latter case, this method supports [range matching](#range-matching). 
See [QuadStore.prototype.get()](#quadstoreprototypeget).

#### QuadStore.prototype.getStream()

    const matchTerms = {graph: 'c'};

    const readableStream = store.getStream(matchTerms);

*Synchronously* returns a `stream.Readable` of all quads matching the terms in 
the specified query.

This method supports [range matching](#range-matching). 
See [QuadStore.prototype.get()](#quadstoreprototypeget).

#### QuadStore.prototype.putStream()

    store.putStream(readableStream, (err) => {});
    store.putStream(readableStream).then(() => {});

Imports all quads coming through the specified `stream.Readable` into the store.

#### QuadStore.prototype.delStream()

    store.delStream(readableStream, (err) => {});
    store.delStream(readableStream).then(() => {});

Deletes all quads coming through the specified `stream.Readable` from the store.

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
    const store = new RdfStore(opts);

Instantiates a new store. The `RdfStore` class extends `QuadStore` and requires
an instance of a leveldb backend as the `opts.backend` argument. In 
addition to all options supported by `QuadStore`, `RdfStore` supports the 
following:

    opts.dataFactory = require('@rdf-data-model');  // REQUIRED: instance of RDF/JS' dataFactory 

The `dataFactory` option *must* be an implementation of the
`dataFactory` interface defined in the RDF/JS specification, such as: 

- [@rdfjs/data-model](https://www.npmjs.com/package/@rdfjs/data-model)
- [N3.js' N3.DataFactory](https://www.npmjs.com/package/n3)

The `contextKey` option from the `QuadStore` class is set to `graph` and cannot
be changed.

#### Graph API, Quad and Term instances

The `RdfStore` class extends the `QuadStore` class. Instead of plain objects, 
the `get`, `put`, `del`, `patch`, `query`, `getStream`, `putStream` and 
`delStream` methods accept and return (streams of and/or arrays of) `Quad` 
objects as produced by the `dataFactory.quad` method. 

Matching terms, such as those used in the `get` and `getStream` methods,
must be `Term` objects as produced by the `dataFactory.namedNode`, 
`dataFactory.blankNode` or `dataFactory.literal` methods. 

The same rules apply for the `match`, `import`, `remove` and `removeMatches` 
methods inherited from the RDF/JS interface.

#### SPARQL Queries

SPARQL queries are supported via the additional package 
[`quadstore-sparql`](https://github.com/beautifulinteractions/node-quadstore).

#### RDF range matching

The RdfStore class inherits support  for [range-based matching](#range-matching), 
with ranges defined using `Term` instances as produced by `dataFactory.namedNode`, 
`dataFactory.literal` and `dataFactory.blankNode`.

Furthermore, values for literal terms with the following numeric datatypes are
expressed and matched according to their numerical values rather than their 
string representations:

```
http://www.w3.org/2001/XMLSchema#integer
http://www.w3.org/2001/XMLSchema#double
```

This is also the case for terms with the following date/time datatypes:

```
http://www.w3.org/2001/XMLSchema#dateTime
```

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
Supports [range-based matching](#rdf-range-matching).
   
See [QuadStore.prototype.get()](#quadstoreprototypeget).

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
Supports [range-based matching](#rdf-range-matching).

### Browser

`quadstore` can be used in browsers via build systems such as:

- [`rollup`](https://rollupjs.org/guide/en/)
- [`webpack`](https://webpack.js.org)
- [`browserify`](http://browserify.org)

Persistent, in-browser storage is supported using the 
[`level-js`](https://github.com/Level/level-js) backend for levelDB.

## Performance

We've yet to develop proper benchmarks. That said, loading the `21million.rdf`
file into an instance of `RdfStore` on Node v12.14.0 running on a 2018 
MacBook Pro (Intel Core i7 2.6 Ghz, SSD storage) clocks at **~15k quads per 
second** and **~4k quads per MB**.

    node perf/loadfile.js /Users/jacoscaz/Downloads/1million.rdf 
 
## LICENSE

See [LICENSE.md](./LICENSE.md).
