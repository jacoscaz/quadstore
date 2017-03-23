
# QUADSTORE [![Build Status](https://travis-ci.org/beautifulinteractions/node-quadstore.svg)](https://travis-ci.org/beautifulinteractions/node-quadstore) #

![Logo](https://github.com/beautifulinteractions/node-quadstore/blob/master/logo.png?raw=true)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[![NPM](https://nodei.co/npm/quadstore.png)](https://nodei.co/npm/quadstore/)

A LevelDB-backed graph database for Node.js with native support for quads.

## Introduction ##

A quad is a triple with an added `context` term. 

    (subject, predicate, object, context)

Such additional term facilitates the representation of metadata, such as provenance, in the form of other quads having
the `context` of the former quads as their subject.
 
Quadstore heavily borrows from LevelGraph's approach to storing tuples but employs a different indexing strategy that 
requires the same number of indexes to handle the additional dimension and efficiently store and query quads.

LevelGraph's approach to storing tuples is described in this presentation 
[How to Cook a Graph Database in a Night](http://nodejsconfit.levelgraph.io/) by LevelGraph's creator Matteo Collina. 

Quadstore's indexing strategy has been developed by [Sarra Abbassi](mailto:abbassy.sarra@gmail.com) and 
[Rim Faiz](mailto:rim.faiz@ihec.rnu.tn) and is described in the paper 
[RDF-4X: a scalable solution for RDF quads store in the cloud](http://dl.acm.org/citation.cfm?id=3012104).

## Status ##

Very much under development.

#### Current features:

- API supports both Promises (native) and callbacks
- Implements [RDF/JS](https://github.com/rdfjs/representation-task-force) Store interface
- Full CRUD of quads
- Advanced queries (union, join, sort, filter)
- Configurable name for context term

#### Upcoming features / goals

- v0.1.0
    - API freeze for current features
    - more unit test coverage 
    - first official release (non alpha)
- v0.2.0
    - better unit tests
    
#### Features we're thinking about

- SPARQL support

## Usage ##

- [Graph Interface](#graph-api)
    - [QuadStore class](#quadstore-class)
    - [QuadStore.prototype.get](#quadstoreprototypeget)
    - [QuadStore.prototype.put](#quadstoreprototypeput)
    - [QuadStore.prototype.del](#quadstoreprototypedel)
    - [QuadStore.prototype.patch](#quadstoreprototypepatch)
    - [QuadStore.prototype.createReadStream](#quadstoreprototypecreatereadstream)
- [RDF/JS Interface](#rdfjs-interface)
    - [RdfStore class](#rdfstore-class)
    - [RdfStore.prototype.match](#rdfstoreprototypematch)
    - [RdfStore.prototype.import](#rdfstoreprototypeimport)
    - [RdfStore.prototype.remove](#rdfstoreprototyperemove)
    - [RdfStore.prototype.removeMatches](#rdfstoreprototyperemovematches)
- [Advanced Queries](#advanced-queries)
    - [(Quad|Rdf)Store.prototype.query](#quadrdfstoreprototypequery)
    - [AbstractQuery.prototype.toReadStream](#abstractqueryprototypetoreadstream)
    - [AbstractQuery.prototype.toReadArray](#abstractqueryprototypetoarray)
    - [AbstractQuery.prototype.join](#abstractqueryprototypejoin)
    - [AbstractQuery.prototype.sort](#abstractqueryprototypesort)
    - [AbstractQuery.prototype.filter](#abstractqueryprototypefilter)
    - [AbstractQuery.prototype.union](#abstractqueryprototypeunion)
  

### Graph API 

#### QuadStore class 

    const QuadStore = require('quadstore').QuadStore;
    const store = new QuadStore('./path/to/db', opts);

Instantiates a new store. Supported options are:

    opts.db = require('leveldown');   // Levelup's backend
    opts.contextKey = 'context';      // Name of fourth term
    
The `contextKey` option determines which key the store will use to read and
write the context of each quad. A value of `graph` requires all quads to be
formatted as `{ subject, predicate, object, graph }` objects.

#### QuadStore.prototype.put() 

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', context: 'c'}
    ];
    
    store.put(quads, (putErr) => {}); // callback
    store.put(quads).then(() => {}); // promise
    
Stores new quads. Does *not* throw or return an error if quads already exists.

#### QuadStore.prototype.del() 

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', context: 'c'}
    ];
    
    store.del(quads, (delErr) => {}); // callback
    store.del(quads).then(() => {}); // promise

Deletes existing quads. Does *not* throw or return an error if quads do not exist within the store.

#### QuadStore.prototype.patch()
 
This methods deletes and inserts quads in a single operation.

If the first argument is an array, it is assumed to be an array of quads
to be deleted.

    const oldQuads = [
        {subject: 'so', predicate: 'po', object: 'oo', context: 'co'}
    ];
    
    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', context: 'cn'}
    ];
    
    store.patch(oldQuads, newQUads, (delputErr) => {}); // callback
    store.patch(oldQuads, newQUads).then(() => {}); // promise
    
if the first argument is not an array, it is assumed to be a set of terms
matching those of the quads to be deleted.

    const matchTerms = {subject: 'so', context: 'co'}
    
    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', context: 'cn'}
    ];
    
    store.patch(matchTerms, newQUads, (delputErr) => {}); // callback
    store.patch(matchTerms, newQUads).then(() => {}); // promise
    
This method does *not* throw or return errors if deleting non-existing quads
or updating pre-existing ones. 

#### QuadStore.prototype.get() 

    const query = {context: 'c'};

    store.get(query, (getErr, matchingQuads) => {}); // callback
    store.get(query).then((matchingQuads) => {}); // promise

Returns all quads within the store matching the terms in the specified query.    

#### QuadStore.prototype.createReadStream() 

    const query = {context: 'c'};
    
    const readableStream = store.createReadStream(query);

Returns a `stream.Readable` of all quads matching the terms in the specified query. 

### RDF/JS Interface 

`quadstore` aims to support the [RDF/JS](https://github.com/rdfjs/representation-task-force)
interface specification through the specialized `RdfStore` class, which currently implements
the `Source`, `Sink` and `Store` interfaces (Term(s)-only, no RegExp(s)).

#### RdfStore class 

    const RdfStore = require('quadstore').RdfStore;
    const store = new RdfStore('./path/to/db', {dataFactory});

Instantiates a new store. The `dataFactory` parameter *must* be an implementation of the 
`dataFactory` interface defined in the RDF/JS specification.

The `RdfStore` class extends the `QuadStore` class. Instead of plain objects, the `get`, 
`put`, `del`, `delput`, `getdelput` and `createReadStream` methods accept and return 
arrays of `Quad()` instances.

#### RdfStore.prototype.match() 

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');
    
    store.match(subject, null, null, graph)
      .on('error', (err) => {})
      .on('data', (quad) => {})
      .on('end', () => {});

Returns a `stream.Readable` of `Quad()` instances matching the provided terms.

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

    store.query({ context: 'c' });

This method is the entry point from which complex queries can be built. 
This method returns an instance of the `AbstractQuery` class, a class that
implements a chainable, lazy-loading, stream-based querying system.  

#### AbstractQuery.prototype.toReadStream()

    store.query({context: 'c'}).toReadStream((err, readStream) => {}); // callback
    store.query({context: 'c'}).toReadStream().then(readStream) => {}); // promise

Creates a stream of quads matching the query.

#### AbstractQuery.prototype.toArray()

    store.query({context: 'c'}).toArray((err, quads) => {}); // callback
    store.query({context: 'c'}).toArray().then(quads) => {}); // promise

Returns an array of quads matching the query.

#### AbstractQuery.prototype.join()

    const query1 = store.query({ context: 'c' });
    const query2 = store.query({ subject: 's' });
    
    store.query(query1)
        .join(query2, ['predicate'])
        .toReadStream((err, readStream) => {});
        
    store.query(query1)
        .join(query2, ['predicate'])
        .toReadStream().then(readStream) => {});

Performs an inner join between the two queries limited to the terms
specified in the array. 

The above example queries for all quads with context `c` and with a predicate 
shared by at least another quad having subject 's'. 

Returns an instance of `AbstractQuery` and can be daisy-chained with
other similar methods to refine queries.

#### AbstractQuery.prototype.sort()

    store.query(query1)
        .sort(['context', 'predicate], false)
        .toReadStream().then(readStream) => {}); // promise

Sorts results in lexicographical order based on the values of the terms in the array.
        
Returns an instance of `AbstractQuery` and can be daisy-chained with other similar 
methods to refine queries.
        
#### AbstractQuery.prototype.filter()

    store.query(query1)
        .filter(quad => quad.subject === 's')
        .toReadStream().then(readStream) => {}); // promise

Filters results according to the provided function.
        
Returns an instance of `AbstractQuery` and can be daisy-chained with other similar 
methods to refine queries.

#### AbstractQuery.prototype.union()

    const query1 = store.query({ context: 'c' });
    const query2 = store.query({ subject: 's' });
    
    store.query(query1)
        .union(query2)
        .toReadStream().then(readStream) => {}); // promise

Merges the results of both queries as if they were a single query (no ordering guaranteed).
        
Returns an instance of `AbstractQuery` and can be daisy-chained with other similar 
methods to refine queries.

### Browser ###

Both the QuadStore and the RdfStore classes can be used in browsers via browserify and level-js:

    const leveljs = require('level-js');
    const QuadStore = require('quadstore').QuadStore;

    const store = new QuadStore('name', { db: leveljs });

## LICENSE - "MIT License" ##

Copyright (c) 2017 Beautiful Interactions.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
