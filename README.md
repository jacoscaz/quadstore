
# QUADSTORE [![Build Status](https://travis-ci.org/beautifulinteractions/node-quadstore.svg)](https://travis-ci.org/beautifulinteractions/node-quadstore) #

A LevelDB-backed graph database for Node.js with native support for quads.

### Introduction ###

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

### Usage ###

    const QuadStore = require('quadstore');
    const store = new QuadStore({db: './path/to/db'});
    
    store.put({subject: 's', predicate: 'p', object: 'o', graph: 'g'}, function(putErr) {
        store.match(({graph: 'g'}, function (getErr, quads) {
            console.log(quads);
        });
    });

### Todo ###

- complex searches, query planning
