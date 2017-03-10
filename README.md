
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

Unstable, very much under development. The following features are missing and are being considered:

- complex searches w/ query planning

## Usage ##

### Graph API ###

    const QuadStore = require('quadstore').QuadStore;
    const store = new QuadStore('./path/to/db');
    
    store.put({subject: 's', predicate: 'p', object: 'o', graph: 'g'}, function(putErr) {
        store.match({graph: 'g'}, function (getErr, quads) {
            console.log(quads);
        });
    });

### RDF API ###

`quadstore` aims to support the [RDF/JS](https://github.com/rdfjs/representation-task-force)
interface specification through the specialized `RdfStore` class, which currently implements
the `Source` and `Sink` interfaces (partially). Support for the `Store` interface is coming.

    const RdfStore = require('quadstore').RdfStore;
    const store = new RdfStore('./path/to/db', {dataFactory});

    // Returns a stream.Readable of dataFactory.Quad(s) matching the specified terms
    const readStream = store.match(term, term, term, term);
    
    // Imports dataFactory.Quad(s) from the provided stream.Readable
    store.import(readStream, (err) => {});

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
