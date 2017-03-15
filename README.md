
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

Very much under development. Planned future features:

- [ ] complex searches w/ query planning

## Usage ##

- [Graph Interface](#graph-api)
    - [QuadStore class](#graph-class)
    - [QuadStore.prototype.get](#graph-get)
    - [QuadStore.prototype.put](#graph-put)
    - [QuadStore.prototype.del](#graph-del)
    - [QuadStore.prototype.delput](#graph-delput)
    - [QuadStore.prototype.getdelput](#graph-getdelput)
    - [QuadStore.prototype.createreadstream](#graph-createreadstream)
- [RDF/JS Interface](#rdf-api)
    - [QuadStore class](#rdf-class)
    - [QuadStore.prototype.match](#rdf-match)
    - [QuadStore.prototype.import](#rdf-import)
    - [QuadStore.prototype.remove](#rdf-remove)
    - [QuadStore.prototype.removeMatches](#rdf-removematches)

### Graph API 
<a name="graph-api"></a>

#### QuadStore class 
<a name="graph-class"></a>

    const QuadStore = require('quadstore').QuadStore;
    const store = new QuadStore('./path/to/db', opts);

Instantiates a new store.

#### QuadStore.prototype.put() 
<a name="graph-put"></a>

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', context: 'c'}
    ];
    
    store.put(quads, (putErr) => {});
    
Stores new quads. Does *not* throw or return an error if quads already exists.

#### QuadStore.prototype.del() 
<a name="graph-del"></a>

    const quads = [
        {subject: 's', predicate: 'p', object: 'o', context: 'c'}
    ];
    
    store.del(quads, (delErr) => {});

Deletes existing quads. Does *not* throw or return an error if quads do not exist within the store.

#### QuadStore.prototype.delput() 
<a name="graph-delput"></a>

    const oldQuads = [
        {subject: 'so', predicate: 'po', object: 'oo', context: 'co'}
    ];
    
    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', context: 'cn'}
    ];
    
    store.delput(oldQuads, newQUads, (delputErr) => {});
    
Deletes `oldQuads` and inserts `newQuads` in a single operation. Does *not* throw or return errors if
deleting non-existing quads or updating already existing quads. 

#### QuadStore.prototype.get() 
<a name="graph-get"></a>

    const query = {context: 'c'};

    store.get(query, (getErr, matchingQuads) => {});

Returns all quads within the store matching the terms in the specified query.

#### QuadStore.prototype.createReadStream() 
<a name="graph-createreadstrean"></a>

    const query = {context: 'c'};
    
    const readableStream = store.createReadStream(query, (getErr, readableStream) => {});

Returns a `stream.Readable` of all quads matching the terms in the specified query. 

#### QuadStore.prototype.getdelput()
<a name="graph-getdelput"></a>

    const delQuery = {context: 'co'};
    const newQuads = [
        {subject: 'sn', predicate: 'pn', object: 'on', context: 'cn'}
    ];
    
    store.getdelput(delQuery, newQuads, (mdiErr) => {});

Deletes all quads matching the terms in `delQuery` and stores `newQuads` in a single operation.

### RDF API 
<a name="rdf-api"></a>

`quadstore` aims to support the [RDF/JS](https://github.com/rdfjs/representation-task-force)
interface specification through the specialized `RdfStore` class, which currently implements
the `Source`, `Sink` and `Store` interfaces (Term(s)-only, no RegExp(s)).

#### RdfStore class 
<a name="rdf-class"></a>

    const RdfStore = require('quadstore').RdfStore;
    const store = new RdfStore('./path/to/db', {dataFactory});

Instantiates a new store. The `dataFactory` parameter *must* be an implementation of the 
`dataFactory` interface defined in the RDF/JS specification.

The `RdfStore` class extends the `QuadStore` class. Instead of plain objects, the `get`, 
`put`, `del`, `delput`, `getdelput` and `createReadStream` methods accept and return 
arrays of `Quad()` instances.

#### RdfStore.prototype.match() 
<a name="rdf-match"></a>

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');
    
    store.match(subject, null, null, graph)
      .on('error', (err) => {})
      .on('data', (quad) => {})
      .on('end', () => {});

Returns a `stream.Readable` of `Quad()` instances matching the provided terms.

#### RdfStore.prototype.import() 
<a name="rdf-match"></a>

    const readableStream; // A stream.Readable of Quad() instances
    
    store.import(readableStream)
      .on('error', (err) => {})
      .on('end', () => {});

Consumes the stream storing each incoming quad.

#### RdfStore.prototype.remove() 
<a name="rdf-remove"></a>

    const readableStream; // A stream.Readable of Quad() instances
    
    store.remove(readableStream)
      .on('error', (err) => {})
      .on('end', () => {});

Consumes the stream removing each incoming quad.

#### RdfStore.prototype.removeMatches() 
<a name="rdf-removematches"></a>

    const subject = dataFactory.namedNode('http://example.com/subject');
    const graph = dataFactory.namedNode('http://example.com/graph');
    
    store.removeMatches(subject, null, null, graph)    
      .on('error', (err) => {})
      .on('end', () => {});

Removes all quad  matching the provided terms.

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
