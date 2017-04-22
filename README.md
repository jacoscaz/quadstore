
# QUADSTORE [![Build Status](https://travis-ci.org/beautifulinteractions/node-quadstore.svg)](https://travis-ci.org/beautifulinteractions/node-quadstore) #

![Logo](https://github.com/beautifulinteractions/node-quadstore/blob/master/logo.png?raw=true)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[![NPM](https://nodei.co/npm/quadstore.png)](https://nodei.co/npm/quadstore/)

A LevelDB-backed graph database for Node.js with native support for quads.

## Table of contents

- [Introduction](#introduction)
- [Status](#status)
- [Usage](#usage)
    - [Graph Interface](#graph-api)
        - [QuadStore class](#quadstore-class)
        - [QuadStore.prototype.get](#quadstoreprototypeget)
        - [QuadStore.prototype.put](#quadstoreprototypeput)
        - [QuadStore.prototype.del](#quadstoreprototypedel)
        - [QuadStore.prototype.patch](#quadstoreprototypepatch)
        - [QuadStore.prototype.getStream](#quadstoreprototypegetstream)
        - [QuadStore.prototype.putStream](#quadstoreprototypeputstream)
        - [QuadStore.prototype.delStream](#quadstoreprototypedelstream)
    - [RDF/JS Interface](#rdfjs-interface)
        - [RdfStore class](#rdfstore-class)
        - [Graph API, Quad and Term instances](#graph-api-quad-and-term-instances)
        - [RdfStore.prototype.get](#rdfstoreprototypeget)
        - [RdfStore.prototype.put](#rdfstoreprototypeput)
        - [RdfStore.prototype.del](#rdfstoreprototypedel)
        - [RdfStore.prototype.patch](#rdfstoreprototypepatch)
        - [RdfStore.prototype.getStream](#rdfstoreprototypegetstream)
        - [RdfStore.prototype.putStream](#rdfstoreprototypeputstream)
        - [RdfStore.prototype.delStream](#rdfstoreprototypedelstream)
        - [RdfStore.prototype.match](#rdfstoreprototypematch)
        - [RdfStore.prototype.import](#rdfstoreprototypeimport)
        - [RdfStore.prototype.remove](#rdfstoreprototyperemove)
        - [RdfStore.prototype.removeMatches](#rdfstoreprototyperemovematches)
    - [Advanced Queries](#advanced-queries)
        - [(Quad|Rdf)Store.prototype.query](#quadrdfstoreprototypequery)
        - [AbstractQuery.prototype.get](#abstractqueryprototypeget)
        - [AbstractQuery.prototype.del](#abstractqueryprototypedel)
        - [AbstractQuery.prototype.getStream](#abstractqueryprototypegetstream)
        - [AbstractQuery.prototype.join](#abstractqueryprototypejoin)
        - [AbstractQuery.prototype.sort](#abstractqueryprototypesort)
        - [AbstractQuery.prototype.filter](#abstractqueryprototypefilter)
        - [AbstractQuery.prototype.union](#abstractqueryprototypeunion)
    - [Browser](#browser)
- [License](#license)

## Introduction ##

A quad is a triple with an added `graph` term.

    (subject, predicate, object, graph)

Such additional term facilitates the representation of metadata, such as provenance, in the form of other quads having
the `graph` of the former quads as their subject or object.

Quadstore heavily borrows from LevelGraph's approach to storing tuples but employs a different indexing strategy that
requires the same number of indexes to handle the additional dimension and efficiently store and query quads.

LevelGraph's approach to storing tuples is described in this presentation
[How to Cook a Graph Database in a Night](http://nodejsconfit.levelgraph.io/) by LevelGraph's creator Matteo Collina.

Quadstore's indexing strategy has been developed by [Sarra Abbassi](mailto:abbassy.sarra@gmail.com) and
[Rim Faiz](mailto:rim.faiz@ihec.rnu.tn) and is described in the paper
[RDF-4X: a scalable solution for RDF quads store in the cloud](http://dl.acm.org/citation.cfm?id=3012104).

## Status ##

Active, under development.

#### Changelog

See [CHANGELOG.md](./CHANGELOG.md).

#### Current features:

- Supports both native Promise(s) and callbacks
- Implements the [RDF/JS](https://github.com/rdfjs/representation-task-force) Store interface
- Full CRUD of quads
- Advanced queries (union, join, sort, filter)

## Relationship with LevelUP / LevelDOWN

`quadstore` uses the [LevelUP](https://github.com/level/levelup) package to
interface with any [LevelDB](http://leveldb.org)-compatible storage backend.

#### Storage backends

- `leveldown` - The [LevelDOWN](https://github.com/level/leveldown/) package offers persistent storage backed by LevelDB itself.
- `memdown` - The [MemDOWN](https://github.com/level/memdown) package offers volatile in-memory storage.
- `level.js` - The [level.js](https://github.com/maxogden/level.js) package  offers persistent in-browser storage through IndexedDB.

#### Default backend

If no backend is specified through the options of the [QuadStore](#quadstore-class)
and [RdfStore](#rdfstore-class) constructors, `levelup` will attempt at `require()`ing
the `leveldown` package **which has to be explicitly installed via `npm`**.

## Usage ##

### Graph API

#### QuadStore class

    const QuadStore = require('quadstore').QuadStore;
    const store = new QuadStore('./path/to/db', opts);

Instantiates a new store. Supported options are:

    opts.db = require('leveldown');   // Levelup's backend
    opts.contextKey = 'graph';        // Name of fourth term

The `contextKey` option determines which key the store will use to read and
write the fourth term of each quad. The default value `graph` requires all quads to be
formatted as `{ subject, predicate, object, graph }` objects. Similarly, the value
`context` would require all quads to be formatted as
`{ subject, predicate, object, context }` objects.

The `db` option is optional and, if provided, *must* be a factory function
returning an object compatible with
[LevelDOWN](https://github.com/level/leveldown/)'s API. See
[Relationship with LevelUP / LevelDOWN](#relationship-with-levelup-leveldown).

#### QuadStore.prototype.get()

    const matchTerms = {graph: 'g'};

    store.get(matchTerms, (getErr, matchingQuads) => {}); // callback
    store.get(matchTerms).then((matchingQuads) => {}); // promise

Returns an array of all quads within the store matching the specified terms.

#### QuadStore.prototype.put()

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'g'}
    ];

    store.put(quads, (putErr) => {}); // callback
    store.put(quads).then(() => {}); // promise

Stores new quads. Does *not* throw or return an error if quads already exists.

#### QuadStore.prototype.del()

This method deletes quads. It Does *not* throw or return an error if the specified
quads are not present in the store.

If the first argument is a quad or an array of quads, this method will delete such
quads from the store.

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', graph: 'g'}
    ];

    store.del(quads, (delErr) => {}); // callback
    store.del(quads).then(() => {}); // promise

If the first argument is a set of matching terms, this method will delete all quads
matching such terms from the store.

    const matchTerms = {graph: 'g'};

    store.del(matchTerms, (delErr) => {}); // callback
    store.del(matchTerms).then(() => {}); // promise

#### QuadStore.prototype.patch()

This methods deletes and inserts quads in a single operation. It Does *not* throw or
return an error if the specified quads are not present in the store (delete) or already
present in the store (update).

If the first argument is a single quad or an array of quads, it is assumed to be an
array of quads to be deleted.

    const oldQuads = [
        {subject: 'so', predicate: 'po', object: 'oo', graph: 'go'}
    ];

    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', graph: 'gn'}
    ];

    store.patch(oldQuads, newQUads, (delputErr) => {}); // callback
    store.patch(oldQuads, newQUads).then(() => {}); // promise

If the first argument is a set of matching terms, this method will delete all quads
matching such terms from the store.

    const matchTerms = {subject: 'so', graph: 'go'}

    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', graph: 'gn'}
    ];

    store.patch(matchTerms, newQuads, (delputErr) => {}); // callback
    store.patch(matchTerms, newQuads).then(() => {}); // promise

#### QuadStore.prototype.getStream()

    const matchTerms = {graph: 'c'};

    const readableStream = store.getStream(matchTerms);

*Synchronously* returns a `stream.Readable` of all quads matching the terms in the specified
query.

#### QuadStore.prototype.putStream()

    store.putStream(readableStream, (err) => {});
    store.putStream(readableStream).then(() => {});

Imports all quads coming through the specified `stream.Readable` into the store.

#### QuadStore.prototype.delStream()

    store.delStream(readableStream, (err) => {});
    store.delStream(readableStream).then(() => {});

Deletes all quads coming through the specified `stream.Readable` from the store.

### RDF/JS Interface

`quadstore` aims to support the [RDF/JS](https://github.com/rdfjs/representation-task-force)
interface specification through the specialized `RdfStore` class, which currently implements
the `Source`, `Sink` and `Store` interfaces (Term(s)-only, no RegExp(s)).

#### RdfStore class

    const RdfStore = require('quadstore').RdfStore;
    const store = new RdfStore('./path/to/db', opts);

Instantiates a new store. Supported options are:

    opts.db = require('leveldown');               // Levelup's backend
    opts.dataFactory = require('rdf-data-model'); // RDFJS dataFactory implementation

The `db` option is optional and, if provided, *must* be a factory function
returning an object compatible with
[LevelDOWN](https://github.com/level/leveldown/)'s API. See
[Relationship with LevelUP / LevelDOWN](#relationship-with-levelup-leveldown).

The `dataFactory` option is mandatory and *must* be an implementation of the
`dataFactory` interface defined in the RDF/JS specification. One such implementation
is available at [rdf-ext/rdf-data-model](https://github.com/rdf-ext/rdf-data-model).

The `contextKey` option from the `QuadStore` class is set to `graph` and cannot be
changed.

#### Graph API, Quad and Term instances

The `RdfStore` class extends the `QuadStore` class. Instead of plain objects, the `get`,
`put`, `del`, `patch`, `query`, `getStream`, `putStream` and `delStream` methods accept
and return (streams of and/or arrays of) `Quad` objects as produced by the
`dataFactory.quad` method. Matching terms, such as those used in the `query`, `get` and
`createReadStream` methods, must be `Term` objects as produced by the
`dataFactory.namedNode`, `dataFactory.blankNode` or `dataFactory.literal` methods.
The same applies for the `match`, `import`, `remove` and `removeMatches` methods inherited
from the RDF/JS interface.

#### RdfStore.prototype.get()
 
    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });

    const matchTerms = {
        subject: dataFactory.namedNode('http://example.com/subject'),
        predicate: dataFactory.namedNode('http://example.com/predicate')
    };

    store.get(matchTerms).then((quads) => {
        // Promise
        // all quads are produced using dataFactory.quad()
    });
    
    store.get(matchTerms, (err, quads) => {
        // Callback
        // all quads are produced using dataFactory.quad()
    });
    
See [QuadStore.prototype.get()](#quadstoreprototypeget).
    
#### RdfStore.prototype.put()

    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });
    
    const newQuads = [
        dataFactory.quad(
            dataFactory.namedNode('http://example.com/subject'),
            dataFactory.namedNode('http://example.com/predicate'),
            dataFactory.literal('object'),
            dataFactory.blankNode('g')
        )
    ];

    store.put(newQuads).then(() => {});
    store.put(newQuads, (err) => {});

See [QuadStore.prototype.put()](#quadstoreprototypeput).
    
#### RdfStore.prototype.del()
 
    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });
        
    const oldQuads = [
        dataFactory.quad(
            dataFactory.namedNode('http://example.com/subject'),
            dataFactory.namedNode('http://example.com/predicate'),
            dataFactory.literal('object'),
            dataFactory.blankNode('g')
        )
    ];

    store.del(newQuads, (err) => {});
    store.del(newQuads).then(() => {});

or

    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });

    const matchTerms = {graph: dataFactory.namedNode('http://example.com/graph')};

    store.del(matchTerms, (err) => {});
    store.del(matchTerms).then(() => {});

See [QuadStore.prototype.del()](#quadstoreprototypedel).

#### RdfStore.prototype.patch()

    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });
        
    const matchTerms = {
        subject: dataFactory.namedNode('http://example.com/subject'),
        predicate: dataFactory.namedNode('http://example.com/predicate')
    };
    
    const newQuads = [
        dataFactory.quad(
            dataFactory.namedNode('http://example.com/subject'),
            dataFactory.namedNode('http://example.com/predicate'),
            dataFactory.literal('object'),
            dataFactory.blankNode('g')
        )
    ];
    
    store.patch(matchTerms, newQuads).then(() => {});
    store.patch(matchTerms, newQuads, (err) => {});

or

    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });

    const oldQuads = [
        dataFactory.quad(
            dataFactory.namedNode('http://old.com/subject'),
            dataFactory.namedNode('http://old.com/predicate'),
            dataFactory.literal('object'),
            dataFactory.blankNode('g')
        )
    ];

    const newQuads = [
        dataFactory.quad(
            dataFactory.namedNode('http://new.com/subject'),
            dataFactory.namedNode('http://new.com/predicate'),
            dataFactory.literal('object'),
            dataFactory.blankNode('g')
        )
    ];

    store.patch(oldQuads, newQuads).then(() => {});
    store.patch(oldQuads, newQuads, (err) => {});
    
See [QuadStore.prototype.patch()](#quadstoreprototypepatch).

#### RdfStore.prototype.getStream()

    const dataFactory = require('rdf-data-model');
    const store = new RdfStore('/path/to/db', { dataFactory });
        
    const matchTerms = {
        subject: dataFactory.namedNode('http://example.com/subject'),
        predicate: dataFactory.namedNode('http://example.com/predicate')
    };

    const readableStream = store.getStream(matchTerms);

*Synchronously* returns a `stream.Readable` of all quads matching the specified terms.

See [QuadStore.prototype.getStream()](#quadstoreprototypegetstream).

#### RdfStore.prototype.putStream()

    store.putStream(readableStream, (err) => {});
    store.putStream(readableStream).then(() => {});

Imports all quads coming through the specified `stream.Readable` into the store.

See [RdfStore.prototype.putStream()](#quadstoreprototypeputstream).

#### RdfStore.prototype.delStream()

    store.delStream(readableStream, (err) => {});
    store.delStream(readableStream).then(() => {});

Deletes all quads coming through the specified `stream.Readable` from the store.

See [RdfStore.prototype.delStream()](#quadstoreprototypedelstream).

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

### Advanced queries

Both the `QuadStore` class and the `RdfStore` class support advanced queries.

#### (Quad|Rdf)Store.prototype.query()

    store.query({ graph: 'g' });

This method is the entry point from which complex queries can be built.
This method returns an instance of the `AbstractQuery` class, a class that
implements a chainable, lazy-loading, stream-based querying system.

If used on instances of `RdfStore`, the `query()` method accepts and returns
quads and matching terms as produced by `dataFactory.quad()` and
`dataFactory.namedNode()`, `dataFactory.blankNode()`, `dataFactory.literal()`.
See [RDF/JS Quad(s) and Term(s)](#rdfjs-quads-and-terms).

#### AbstractQuery.prototype.get()

    // QuadStore
    quadStore.query({graph: 'g'}).toArray((err, quads) => {}); // callback
    quadStore.query({graph: 'g'}).toArray().then(quads) => {}); // promise

    // RdfStore
    rdfStore.query({graph: dataFactory.blankNode('c')}).toArray((err, quads) => {}); // callback
    rdfStore.query({graph: dataFactory.blankNode('c')}).toArray().then(quads) => {}); // promise

Returns an array of quads matching the query.

#### AbstractQuery.prototype.del()

    // QuadStore
    quadStore.query({graph: 'g'}).del((err) => {}); // callback
    quadStore.query({graph: 'g'}).del().then() => {}); // promise

    // RdfStore
    rdfStore.query({graph: dataFactory.blankNode('c')}).del((err) => {}); // callback
    rdfStore.query({graph: dataFactory.blankNode('c')}).del().then() => {}); // promise

Removes all matching quads from the store in one single operation.
See also [AbstractQuery.prototype.delStream()](#abstractqueryprototypedelstream).

#### AbstractQuery.prototype.getStream()

    // QuadStore
    const readableStream = quadStore.query({graph: 'g'}).getStream();

    // RdfStore
    const readableStream = rdfStore.query({graph: dataFactory.blankNode('c')}).getStream();

*Synchronously* returns a stream of quads matching the query.

#### AbstractQuery.prototype.join()

    // QuadStore
    const matchTermsA = {graph: 'g'};
    const matchTermsB = {subject: 's'};
    quadStore.query(matchTermsA)
        .join(quadStore.query(matchTermsB), ['predicate'])
        .get((err, quads) => {});

    // RdfStore
    const matchTermsA = {graph: dataFactory.namedNode('http://example.com/graph')};
    const matchTermsB = {subject: dataFactory.namedNode('http://example.com/subject')};
    rdfStore.query(matchTermsA)
        .join(rdfStore.query(matchTermsB), ['predicate'])
        .get((err, quads) => {});

Performs an inner join between the two queries limited to the terms
specified in the array.

The above example queries for all quads with graph `g` and with a predicate
shared by at least another quad having subject 's'.

Returns an instance of `AbstractQuery` and can be daisy-chained with
other similar methods to refine queries.

#### AbstractQuery.prototype.sort()

    // QuadStore
    quadStore.query(matchTerms)
        .sort(['graph', 'predicate], false)
        .get().then(quads) => {});

    // RdfStore
    rdfStore.query(matchTerms)
        .sort(['graph', 'predicate], false)
        .get().then(quads) => {});

Sorts results in lexicographical order based on the values of the terms in the array.

Returns an instance of `AbstractQuery` and can be daisy-chained with other similar
methods to refine queries.

#### AbstractQuery.prototype.filter()

    // QuadStore
    quadStore.query(matchTerms)
        .filter(quad => quad.subject === 's')
        .get().then(quads) => {});

    // RdfStore
    rdfStore.query(matchTerms)
        .filter(quad => quad.subject.termType === 'NamedNode')
        .get().then(quads) => {});

Filters results according to the provided function.

Returns an instance of `AbstractQuery` and can be daisy-chained with other similar
methods to refine queries.

#### AbstractQuery.prototype.union()

    store.query(matchTermsA)
        .union(store.query(matchTermsB))
        .get().then(quads) => {});

Merges the results of both queries as if they were a single query (no ordering guaranteed).

Returns an instance of `AbstractQuery` and can be daisy-chained with other similar
methods to refine queries.

### Browser

Both the `QuadStore` and the `RdfStore` classes can be used in browsers via `browserify` and `level-js`:

    const leveljs = require('level-js');
    const QuadStore = require('quadstore').QuadStore;

    const store = new QuadStore('name', { db: leveljs });

## LICENSE

See [LICENSE.md](./LICENSE.md).
