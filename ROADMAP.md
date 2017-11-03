
# QUADSTORE'S ROADMAP

## Version 4.0

- Internal SPARQL query engine
    - Extract the internal sparql query engine from ldf-client and refactor it 
      to make it work directly on instances of the RDF/JS Source interface
    - Share the results with the RDF/JS community by publishing the new engine 
    - Replace ldf-client with the new engine
- Range queries
    - Implement enumerator to sort numeric values lexicographically
    - Extend the RDF/JS Source interface to support advertising custom features
      and implement such an extension
    - Work on extending the RDF/JS `Source` interface to support filtering 
      options in `.match()` and implement such an extension through a dedicated
      filtering engine in `Quadstore` and `RdfStore`  
    - Extend the sparql engine to support passing filtering options to the 
      backing `Source` instance if supported
- Clean-up
    - Switch to RDF/JS version of N3
    - Replace streams with `AsyncIterator`s where possible
    - Drop old query code
    - Improve test suite
- RDF/JS community
    - Try to work together on supporting feature advertising and filtering 
      options
    - Try to work together on the repackaged sparql engine
    - Share ideas about standard HTTP API matching RDF/JS
- HTTP API
    - Repackage HTTP layer into (a) dedicated package(s)

## Version 5.0

- Add support for `UPDATE` queries into the repackaged query engine
- Add support for federated queries into the repackaged query engine
