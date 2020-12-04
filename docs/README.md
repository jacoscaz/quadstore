
![Logo](https://github.com/beautifulinteractions/node-quadstore/blob/master/logo.png?raw=true)

# QUADSTORE

Quadstore is a LevelDB-backed RDF graph database for Node.js and the browser
with native support for quads and querying across named graphs, RDF/JS
interfaces and SPARQL queries.

## Table of contents

- [Introduction](#introduction)
- [Status](#status)
  - [Roadmap](#roadmap)
  - [Changelog](#changelog)
  - [Current version and features](#current-version)
  - [Notes](#notes)
- [Usage](#usage)
  - [Storage](#storage-backends)
  - [Data model and return Values](#data-model-and-return-values)
  - [Quadstore class](#quadstore-class)
  - [Custom indexes](#custom-indexes)
  - [Quadstore.prototype.open](#quadstoreprototypeopen)
  - [Quadstore.prototype.close](#quadstoreprototypeclose)
  - [Quadstore.prototype.get](#quadstoreprototypeget)
  - [Range matching](#range-matching)
  - [Quadstore.prototype.put](#quadstoreprototypeput)
  - [Quadstore.prototype.multiPut](#quadstoreprototypemultiput)
  - [Quadstore.prototype.del](#quadstoreprototypedel)
  - [Quadstore.prototype.multiDel](#quadstoreprototypemultidel)
  - [Quadstore.prototype.patch](#quadstoreprototypepatch)
  - [Quadstore.prototype.multiPatch](#quadstoreprototypemultipatch)
  - [Quadstore.prototype.getStream](#quadstoreprototypegetstream)
  - [Quadstore.prototype.putStream](#quadstoreprototypeputstream)
  - [Quadstore.prototype.delStream](#quadstoreprototypedelstream)
  - [Quadstore.prototype.sparql](#quadstoreprototypesparql)
  - [Quadstore.prototype.sparqlStream](#quadstoreprototypesparqlstream)
  - [Quadstore.prototype.match](#quadstoreprototypematch)
  - [Quadstore.prototype.import](#quadstoreprototypeimport)
  - [Quadstore.prototype.remove](#quadstoreprototyperemove)
  - [Quadstore.prototype.removeMatches](#quadstoreprototyperemovematches)
- [Browser usage](#browser-usage)
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

Quadstore heavily borrows from [LevelGraph's approach to storing tuples][i1],
maintaining multiple indexes each of which deals with a different permutation
of quad terms. In that sense, Quadstore is an alternative to [LevelGraph][i3]
that strikes a different compromise between expressiveness and performance,
opting to natively supporting quads while working towards minimizing
[the performance penalty][i4] that comes with the fourth term.

[i1]: http://nodejsconfit.levelgraph.io
[i3]: https://github.com/levelgraph/levelgraph
[i4]: https://github.com/levelgraph/levelgraph/issues/43#issuecomment-29519727

## Status

Active, under development.

### Changelog

See [CHANGELOG.md](./CHANGELOG.md).

### Current version

Current version: **v7.1.1** available on NPM under the tag `latest`.

### Roadmap

We're currently working on the following features:

- expanding support for SPARQL queries;
- general performance improvements.

We're also evaluating the following features for future developments:

- [RDF*][r1] (see also [these slides][r2])

[r1]: https://blog.liu.se/olafhartig/2019/01/10/position-statement-rdf-star-and-sparql-star/
[r2]: http://olafhartig.de/slides/W3CWorkshop2019RDFStarAndSPARQLStar.pdf

### Notes

- uses [Semantic Versioning](https://semver.org), pre-releases are tagged
  accordingly;
- the `production` branch mirrors what is available under the `latest` tag on NPM;
- the `master` branch is the active, development branch;
- requires Node.js >= 10.0.0.

## Usage

### Storage backends

`quadstore` can work with any [LevelDB][db0]-compatible storage backend that
implements the [AbstractLevelDOWN interface][db1].

We test `quadstore` using the following backends:

- [`leveldown`][db2] for persistent storage backed by LevelDB itself
- [`memdown`][db3] for volatile in-memory storage

[db0]: http://leveldb.org
[db1]: https://github.com/Level/abstract-leveldown
[db2]: https://github.com/level/leveldown
[db3]: https://github.com/level/memdown

### Data model and return values

Except for those related to the [RDF/JS stream interfaces][dm-2], `quadstore`'s
API is promise-based and all methods return objects that include both the actual
query results and the relevant metadata.

Objects returned by `quadstore`'s APIs have the `type` property set to one of
the following values:

- `"VOID"` - when there's no data returned by the database, such as with the
  `put` method or `INSERT DATA` SPARQL queries;
- `"QUADS"` - when a query returns a collection of quads;
- `"BOOLEAN"` - when a query returns a boolean result;
- `"BINDINGS"` - when a query returns a collection of bindings;
- `"APPROXIMATE_SIZE"` - when a query returns an approximate count of how many
  matching items are present.

For those methods that return objects with the `type` property set to either
`"QUADS"` or `"BINDINGS"`, `quadstore` provides query results either in streaming
mode or in non-streaming mode.

Streaming methods such as `getStream` and `searchStream` return objects with
the `iterator` property set to an instance of [`AsyncIterator`][dm-4],
an implementation of a subset of the `stream.Readable` interface. This instance
emits either quads or bindings, depending on the value of the `type` property.

Non-streaming methods such as `get` and `search` return objects with the
`items` property set to an array of either quads or bindings, depending on the
value of the `type` property.

Quads are returned as and expected to be instances of the
[RDF/JS `Quad` interface][dm-1] as produced by the implementation of the
[RDF/JS `DataFactory` interface][dm-1] passed to the `Quadstore` constructor.

Bindings are returned as and expected to be maps of variable names
(including `?`) to instances of the [RDF/JS Term interface][dm-1] as produced
by the same implementation of the [RDF/JS DataFactory interface][dm-1].

Matching patterns, such as those used in the `get` and `getStream` methods,
are expected to be maps of term names to instances of the
[RDF/JS Term interface][dm-1].

[dm-1]: https://rdf.js.org/data-model-spec/
[dm-2]: https://rdf.js.org/stream-spec/
[dm-3]: https://github.com/rdfjs-base/data-model
[dm-4]: https://github.com/RubenVerborgh/AsyncIterator#readme

### Access to the backend

The backend of a `quadstore` can be accessed with the `db` property, to perform
additional storage operations independently of quads.

In order to perform write operations atomically with quad storage, the `put`,
`multiPut`, `del`, `multiDel`, `patch` and `multiPatch` methods accept a
`preWrite` option which defines a procedure to augment the batch, as in the
following example:

```js
await store.put(dataFactory.quad(/* ... */), {
  preWrite: batch => batch.put('my.key', Buffer.from('my.value'))
});
```

### Quadstore class

```js
const Quadstore = require('quadstore').Quadstore;
const store = new Quadstore(opts);
```

Instantiates a new store. Supported properties for the `opts` argument
are:

##### opts.backend

The `opts.backend` option **must** be an instance of a leveldb backend.
See [storage backends](#storage-backends).

##### opts.dataFactory

The `dataFactory` option *must* be an implementation of the
[RDF/JS DataFactory interface][dm-1]. Some of the available
implementations:

- [rdf-data-factory](https://www.npmjs.com/package/rdf-data-factory) (default)
- [@rdfjs/data-model](https://www.npmjs.com/package/@rdfjs/data-model)
- [N3.DataFactory](https://www.npmjs.com/package/n3)

If left undefined, `quadstore` will automatically instantiate
one using `rdf-data-factory`.

##### opts.indexes

The `opts.indexes` option allows users to configure which indexes will be used
by the store. If not set, the store will default to the following indexes:

```js
[
  ['subject', 'predicate', 'object', 'graph'],
  ['object', 'graph', 'subject', 'predicate'],
  ['graph', 'subject', 'predicate', 'object'],
  ['object', 'subject', 'predicate', 'graph'],
  ['predicate', 'object', 'graph', 'subject'],
  ['graph', 'predicate', 'object', 'subject'],
]; 
```

This option, if present, **must** be set to an array of term arrays, each of
which **must** represent one of the 24 possible permutations of the four terms
`subject`, `predicate`, `object` and `graph`. Partial indexes are not
supported.

The store will automatically select which index(es) to use for a given query
based on the available indexes and the query itself. **If no suitable index is
found for a given query, the store will throw an error**.

##### opts.prefixes

Also, `Quadstore` can be configured with a `prefixes` object that defines a
reversible mapping of IRIs to abbreviated forms, with the intention of reducing
the storage cost where common HTTP prefixes are known in advance.

The `prefixes` object defines a bijection using two functions `expandTerm` and
`compactIri`, both of which take a string parameter and return a string, as in
the following example:

```js
opts.prefixes = {
  expandTerm: term => term.replace(/^ex:/, 'http://example.com/'),
  compactIri: iri => iri.replace(/^http:\/\/example\.com\//, 'ex:'),
}
```

This will replace the IRI `http://example.com/a` with `ex:a` in storage.

### Quadstore.prototype.open()

This method opens the store and throws if the open operation fails for any reason.

### Quadstore.prototype.close()

This method closes the store and throws if the open operation fails for any reason.

### Quadstore.prototype.get()

```js
const pattern = {graph: dataFactory.namedNode('ex://g')};
const { items } = await store.get(pattern);
```

Returns an array of all quads within the store matching the specified terms.

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.defaultGraphMode`: this can be set to either `"default"` or `"union"`
  and allows client to specify whether the default graph used in queries should
  be the actual default graph or the union of all graphs present in the
  database.

### Range matching

`quadstore` supports range-based matching in addition to value-based matching.
Ranges can be defined using the `gt`, `gte`, `lt`, `lte` properties:

```js
const pattern = {
  object: {
    termType: 'Range',
    gt: dataFactory.literal('7', 'http://www.w3.org/2001/XMLSchema#integer')
  }
};
const { items } = await store.get(matchTerms);
```

Values for literal terms with the following numeric datatypes are matched
against their numerical values rather than their literal representations:

```
http://www.w3.org/2001/XMLSchema#integer
http://www.w3.org/2001/XMLSchema#decimal
http://www.w3.org/2001/XMLSchema#double
http://www.w3.org/2001/XMLSchema#nonPositiveInteger
http://www.w3.org/2001/XMLSchema#negativeInteger
http://www.w3.org/2001/XMLSchema#long
http://www.w3.org/2001/XMLSchema#int
http://www.w3.org/2001/XMLSchema#short
http://www.w3.org/2001/XMLSchema#byte
http://www.w3.org/2001/XMLSchema#nonNegativeInteger
http://www.w3.org/2001/XMLSchema#unsignedLong
http://www.w3.org/2001/XMLSchema#unsignedInt
http://www.w3.org/2001/XMLSchema#unsignedShort
http://www.w3.org/2001/XMLSchema#unsignedByte
http://www.w3.org/2001/XMLSchema#positiveInteger
```

This is also the case for terms with the following date/time datatypes:

```
http://www.w3.org/2001/XMLSchema#dateTime
```

### Quadstore.prototype.put()

```js
await store.put(dataFactory.quad(/* ... */));
```

Stores a new quad. Does *not* throw or return an error if the quad already exists.

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.preWrite`: this can be set to a function which accepts a
  [chainedBatch](https://github.com/Level/abstract-leveldown#chainedbatch) and
  performs additional backend operations atomically with the `put` operation.
  See [Access to the backend](#access-to-the-backend) for more information.

### Quadstore.prototype.multiPut()

```js
await store.multiPut([
  dataFactory.quad(/* ... */),
  dataFactory.quad(/* ... */),
]);
```

Stores new quads. Does *not* throw or return an error if quads already exists.

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.preWrite`: this can be set to a function which accepts a
  [chainedBatch](https://github.com/Level/abstract-leveldown#chainedbatch) and
  performs additional backend operations atomically with the `put` operation.
  See [Access to the backend](#access-to-the-backend) for more information.

### Quadstore.prototype.del()

This method deletes a single quad. It Does *not* throw or return an error if the
specified quad is not present in the store.

```js
await store.del(dataFactory.quad(/* ... */));
```

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.preWrite`: this can be set to a function which accepts a
  [chainedBatch](https://github.com/Level/abstract-leveldown#chainedbatch) and
  performs additional backend operations atomically with the `put` operation.
  See [Access to the backend](#access-to-the-backend) for more information.

### Quadstore.prototype.multiDel()

This method deletes multiple quads. It Does *not* throw or return an error if
the specified quads are not present in the store.

```js
await store.multiDel([
  dataFactory.quad(/* ... */),
  dataFactory.quad(/* ... */),
]);
```

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.preWrite`: this can be set to a function which accepts a
  [chainedBatch](https://github.com/Level/abstract-leveldown#chainedbatch) and
  performs additional backend operations atomically with the `put` operation.
  See [Access to the backend](#access-to-the-backend) for more information.

### Quadstore.prototype.patch()

This method deletes one quad and inserts another quad in a single operation.
It Does *not* throw or return an error if the specified quads are not present
in the store (delete) or already present in the store (update).

```js
await store.patch(
        dataFactory.quad(/* ... */),  // will be deleted
        dataFactory.quad(/* ... */),  // will be inserted
);
```

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.preWrite`: this can be set to a function which accepts a
  [chainedBatch](https://github.com/Level/abstract-leveldown#chainedbatch) and
  performs additional backend operations atomically with the `put` operation.
  See [Access to the backend](#access-to-the-backend) for more information.

### Quadstore.prototype.multiPatch()

This method deletes and inserts quads in a single operation. It Does *not*
throw or return an error if the specified quads are not present in the store
(delete) or already present in the store (update).

```js
// will be deleted
const oldQuads = [
  dataFactory.quad(/* ... */),
  dataFactory.quad(/* ... */),
];

// will be inserted
const newQuads = [ // will be inserted
  dataFactory.quad(/* ... */),
  dataFactory.quad(/* ... */),
  dataFactory.quad(/* ... */),
];

await store.multiPatch(oldQuads, newQuads);
```

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.preWrite`: this can be set to a function which accepts a
  [chainedBatch](https://github.com/Level/abstract-leveldown#chainedbatch) and
  performs additional backend operations atomically with the `put` operation.
  See [Access to the backend](#access-to-the-backend) for more information.

### Quadstore.prototype.getStream()

```js
const pattern = {graph: dataFactory.namedNode('ex://g')};
const { iterator } = await store.getStream(pattern);
```

This method supports [range matching](#range-matching),
see [QuadStore.prototype.get()](#quadstoreprototypeget).

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.defaultGraphMode`: this can be set to either `"default"` or `"union"`
  and allows client to specify whether the default graph used in queries should
  be the actual default graph or the union of all graphs present in the
  database.

### Quadstore.prototype.putStream()

```js
await store.putStream(readableStream);
```

Imports all quads coming through the specified `stream.Readable` into the store.

### Quadstore.prototype.delStream()

```js
await store.delStream(readableStream);
```

Deletes all quads coming through the specified `stream.Readable` from the store.


### Quadstore.prototype.sparql()

The `sparql()` method provides support for non-streaming SPARQL queries.
Objects returned by `sparql()` have their `type` property set to different
values depending on each specific query:

- `SELECT` queries will result in objects having their `type` property
  set to `"BINDINGS"`;
- `CONSTRUCT` queries will result in objects objects having their `type`
  property set to `"QUADS"`;
- `UPDATE` queries such as `INSERT DATA`, `DELETE DATA` and
  `INSERT/DELETE WHERE` will result in objects having their `type` property set
  to either `"VOID"` or `"BOOLEAN"`.

```js
const { type, items } = await store.sparql(`
  SELECT * WHERE { ?s <ex://knows> <ex://alice> . }
`);
```

The `sparql()` also accepts an optional `opts` parameter with the following
properties:

- `opts.defaultGraphMode`: this can be set to either `"default"` or `"union"`
  and allows client to specify whether the default graph used in queries should
  be the actual default graph or the union of all graphs present in the
  database.

We're using the [`rdf-test-suite`][s4] package to validate our
support for SPARQL queries against official test suites published by the W3C.

We're currently testing against the following manifests:

- [SPARQL 1.0][s1]: 269/438 tests passing (`npm run test-rdf:sparql10`)
- [SPARQL 1.1][s2]: 245/271 tests passing (`npm run test-rdf:sparql11`,
  limited to the [SPARQL 1.1 Query spec][s3])

[s1]: https://w3c.github.io/rdf-tests/sparql11/data-r2/manifest.ttl
[s2]: https://w3c.github.io/rdf-tests/sparql11/data-sparql11/manifest-all.ttl
[s3]: http://www.w3.org/TR/sparql11-query/
[s4]: https://www.npmjs.com/package/rdf-test-suite

### Comunica

`quadstore` runs most `SPARQL` queries through [a dedicated engine][c2] built
on a custom configuration of the [Comunica meta-engine framework][c1].

Many thanks to [Comunica's contributors][c3] for sharing such a wonderful
project with the global community.

[c1]: https://github.com/comunica/comunica
[c2]: https://github.com/beautifulinteractions/node-quadstore-comunica
[c3]: https://github.com/comunica/comunica/graphs/contributors

### Quadstore.prototype.sparqlStream()

The `sparqlStream()` method provides support for streaming SPARQL queries.
Objects returned by `sparqlStream()` have their `type` property set to
different values depending on each specific query, as for `sparql()`.

```js
const { iterator } = await store.sparqlStream(`
  SELECT * WHERE { ?s <ex://knows> <ex://alice> . }
`);
```

See [Quadstore.prototype.sparql()](#quadstoreprototypesparql).

### Quadstore.prototype.match()

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');
    store.match(subject, null, null, graph)
      .on('error', (err) => {})
      .on('data', (quad) => {
        // Quad is produced using dataFactory.quad()
      })
      .on('end', () => {});

Implementation of the [RDF/JS Source#match method][dm-2]. Supports
[range-based matching](#range-matching).

This method also accepts an optional `opts` parameter with the following
properties:

- `opts.defaultGraphMode`: this can be set to either `"default"` or `"union"`
  and allows client to specify whether the default graph used in queries should
  be the actual default graph or the union of all graphs present in the
  database.

### Quadstore.prototype.import()

    const readableStream; // A stream.Readable of Quad() instances
    store.import(readableStream)
      .on('error', (err) => {})
      .on('end', () => {});

Implementation of the [RDF/JS Sink#import method][dm-2].

### Quadstore.prototype.remove()

    const readableStream; // A stream.Readable of Quad() instances
    store.remove(readableStream)
      .on('error', (err) => {})
      .on('end', () => {});

Implementation of the [RDF/JS Store#remove method][dm-2].

### Quadstore.prototype.removeMatches()

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');
    store.removeMatches(subject, null, null, graph)
      .on('error', (err) => {})
      .on('end', () => {});

Implementation of the [RDF/JS Sink#removeMatches method][dm-2].

## Browser usage

The [`level-js`][b1] backend for levelDB offers support for browser-side
persistent storage.

`quadstore` can be bundled for browser-side usage via Webpack, preferably using
version 4.x. The [reference repository][b0] is meant to help in getting to a
working Webpack configuration and also hosts a pre-built bundle with everything
that is required to use `quadstore` in the browser.

Rollup, ES modules and tree-shaking are not supported (yet).

[b0]: https://github.com/beautifulinteractions/node-quadstore-webpack-bundle
[b1]: https://github.com/Level/level-js

## Performance

The testing platform is a 2018 MacBook Pro (Intel Core i7 2.6 Ghz, SSD storage)
running Node v14.0.0.

### Importing quads

We keep an eye on write speeds by importing the [`21million.rdf`][21mil-rdf]
file or a subset of it.

With the default six indexes and the `leveldown` backend, the `RdfStore` class
clocks at **~15k quads per second** when importing quads one-by-one and at
**~18k quads per second** when importing quads in small batches, with a density
of **~4k quads per MB**.

```
node dist/perf/loadfile.js /path/to/21million.rdf
```

[21mil-rdf]: https://github.com/dgraph-io/benchmarks/blob/master/data/21million.rdf.gz

### Join queries

We track the computational cost of handling `get()` and `getStream()` queries
(setting up iterators, etc...) by running a benchmark based on a SPARQL query
that results in a high number of concatenated join operations, each producing
a single quad.

```
node dist/perf/search.js
```

Quadstore is currently able to process **~5k join operations per second**.

## LICENSE

MIT. See [LICENSE.md](./LICENSE.md).
