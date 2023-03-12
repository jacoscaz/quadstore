
# CHANGELOG

## 12.0.0-alpha.2

- **[breaking]** uses a simpler and faster (de)serialization technique
  that operates solely on keys, with no need for values   
  (https://github.com/belayeng/quadstore/issues/157)
- *[internal]* avoids repeated serializations of the same term   
  (https://github.com/belayeng/quadstore/issues/156)

## 11.0.7

- *[internal]* updated dependencies to latest versions

## 11.0.5

- *[internal]* ported test suite to TypeScript and made it run both
  server-side (`mocha` using the `MemoryLevel` and `ClassicLevel`
  backends) and browser-side (`mocha` within a webpage loaded via
  `puppeteer` using the `MemoryLevel` and `BrowserLevel` backends)   
  (https://github.com/belayeng/quadstore/issues/150)

## 11.0.3

- *[fix]* fixes breaking serialization of terms that serialize to strings
  longer than 127 chars      
  (https://github.com/belayeng/quadstore/issues/152)
- *[internal]* replaces `asynciterator`'s `TransformIterator` with `wrap()`    
  following upstream performance work   
  (https://github.com/RubenVerborgh/AsyncIterator/issues/44)

## 11.0.0

- **[breaking]** upgraded to the new generation of `*-level` packages   
  (https://github.com/Level/community#how-do-i-upgrade-to-abstract-level)
- **[breaking]** uses `Uint16Array` instead of `Buffer` for value
  (de)serialization
- *[new]* adds support for ES modules through separate CJS and ESM builds   
  (https://github.com/belayeng/quadstore/issues/138)
- *[new]* adds support for Deno   
  (https://github.com/belayeng/quadstore/issues/139)
- *[internal]* moves performance tests to dedicated repository   
  (https://github.com/belayeng/quadstore-perf)
- *[internal]* upgrades to newer versions of `asynciterator` where
  we've done a lot of work on optimizing synchronous transforms
  (https://github.com/RubenVerborgh/AsyncIterator/issues/44#issuecomment-1201438495)

## 10.0.0

- **[breaking]** drops all SPARQL-related features in favor of
  `quadstore-comunica`, for greater separation of concerns
- **[breaking]** stops shipping `rdf-data-factory` as the default
  implementation of RDF/JS's `DataFactory` interface
- *[fix]* throws when `backend` is not an instance of `AbstractLevelDOWN`    
  (https://github.com/belayeng/quadstore/issues/140)
- *[fix]* lands upstream fix to variable selection in SPARQL OPTIONAL clauses   
  (https://github.com/belayeng/quadstore/issues/142)
- *[internal]* replaces `immutable` and `decimal.js` with smaller
  alternatives in `quadstore-comunica`, dropping ~60 kB from the 
  final bundle size     
  (https://github.com/belayeng/quadstore/issues/143)
- *[docs]* adds basic example to `README`     
  (https://github.com/belayeng/quadstore/issues/145)

## 9.1.0

- *[fix]* fixes missing dependencies used for type declarations   
  (https://github.com/belayeng/quadstore/issues/136)

## 9.0.0

- **[breaking]** removes support for DEFAULT vs. UNION default graph modes
- *[fix]* fixes breaking blank node correlations     
  (https://github.com/belayeng/quadstore/issues/134)
- *[fix]* fixes repeated calls to `AbstractIterator#end()`   
- *[internal]* fixes duplicated typings for the comunica engine
  (https://github.com/belayeng/quadstore/issues/129)
- *[internal]* offloads SPARQL UPDATE queries to Comunica
- *[internal]* brings SPARQL spec compliance tests close to 100% passing

## 8.0.0

- **[breaking]** deep revision of the serialization mechanism to remove 
  duplicated quad serializations across indexes
- **[breaking]** removes support for custom `separator` and `boundary`
- **[breaking]** an instance of Comunica's `ActorInitSparql` must now be passed
  to the `Quadstore` constructor via the `opts` argument, adding support for 
  Comunica configurations other than `quadstore-comunica`  
  (https://github.com/belayeng/quadstore/issues/122)
- *[fix]* fixes deep equality checks for literal terms in tests
- *[fix]* re-enables the symmetric join actor in Comunica  
  (https://github.com/joachimvh/asyncjoin/issues/7)
- *[internal]* takes comparators out of the Quadstore class

## v7.3.1

- *[fix]* fixes broken `JOIN` SPARQL queries when `approximateSize()` rounds to 0  
  (https://github.com/belayeng/quadstore/pull/127)
- *[fix]* fixes broken SPARQL queries due to Comunica operating in generalized
  RDF mode which can lead to literals being passed as the `subject` arg to
  `match()`  
  (https://github.com/belayeng/quadstore/pull/127)

## v7.3.0

- *[new]* quad scoping support via `initScope()`, `loadScope()`,
  `deleteScope()` and `deleteAllScopes()` methods   
  (https://github.com/belayeng/quadstore/issues/124)
- *[new]* added [`rocksdb`](https://github.com/level/rocksdb) to the list of
  tested backends

## v7.2.1

- *[fix]* fixes broken browser builds due to naming collisions between nested
  webpack bundles  
  (https://github.com/belayeng/quadstore-comunica/blob/5cfc803cb0864f089b07d3cf9850c0e377373e58/README.md#build)

## v7.2.0

- *[fix]* fixes race condition within the `AsyncIterator` wrapper around `AbstractLevelIterator`  
  (https://github.com/belayeng/quadstore/pull/125)
- *[internal]* updates to `quadstore-comunica@0.2.0` (non-minified bundle)
- *[internal]* updates third-party dependencies to their latest versions

## v7.1.1

- *[fix]* fixes unsupported `DESCRIBE` SPARQL queries
- *[fix]* fixes unsupported `ORDER BY` SPARQL expressions

## v7.1.0

- *[new]* `preWrite` hook to support atomic writes of quads plus custom
  key-value pairs  
  (https://github.com/belayeng/quadstore/pull/120)
- *[fix]* prefix-based compaction/expansion of literal datatype IRIs  
  (https://github.com/belayeng/quadstore/issues/118)
- *[fix]* quadstore can now be bundles using browserify without the
  `ignoreMissing` configuration param  
  (https://github.com/belayeng/quadstore/issues/117)
- *[fix]* dropped indirect dev dependency on `@comunica/actor-init-sparql`  
  (https://github.com/belayeng/quadstore/issues/116)

## v7.0.1

- *[new]* added support for range queries
- *[new]* added support for user-defined indexes
- *[new]* added support for SPARQL queries via
  [quadstore-comunica](https://github.com/belayeng/quadstore-comunica)
- **[breaking]** moved to using `master` as the development branch
- **[breaking]** dropped support for matching terms in `del()` and `patch()`
  methods
- **[breaking]** refactored `del()`, `put()` and `patch()` into single-quad and
  multi-quad variants (`multiDel()`, `multiPut()`, `multiPatch()`)
- **[breaking]** refactored all APIs to return results wrapped in results objects
- **[breaking]** refactored all streaming APIs to use `AsyncIterator` and
  asynchronous entrypoints with the exception of `RDF/JS` methods
- **[breaking]** dropped support for the non-RDF API
- **[breaking]** dropped support for previous implementation of custom indexes
- **[breaking]** dropped support for callbacks
- **[breaking]** refactored constructors to only use a single `opts` argument,
  passing the leveldb backend instance via the `opts.backend` property
- **[breaking]** dropped support for the `ready` event, replaced by the
  `.open()` and `.close()` methods
- *[internal]* dropped a few dependencies by pulling in the relevant code
- *[internal]* added index-specific test suites
- *[internal]* refactored folder structure
- *[internal]* ported the whole project to Typescript

## v6.0.1

- **[breaking]** drops pre-assembled browser bundle.
- *[internal]* adds node.js 12 to Travis config.

## v5.2.0

- *[internal]* updates outdated dependencies.

## v5.1.0

- *[internal]* switches to `readable-stream` module as a substitute for the
  native `stream` module.

## v5.0.2

- **[breaking]** extracts sparql and http support into separate packages

## v4.0.1

- **[breaking]** updates leveldown, levelup
- **[breaking]** changes the way `LevelDB`'s backends are passed to constructors
- **[breaking]** makes `.sparql()` method `async`
- *[internal]* updates `N3` to RDF/JS version
- *[internal]* switches to the `@comunica-/actor-init-sparql-rdfjs` SPARQL engine
- *[internal]* consolidates dependencies

## v3.0.0

- deprecates `.query()`
- adds support for SPARQL
- adds HTTP API w/ LDF endpoint
- improves test suite

## v2.1.1

- new, (hopefully) cleaner API
  - `getStream()`, `putStream()` and `delStream()` methods
  - `query.get()`, `query().del()` methods
- less code duplication
- `master` branch now tracking NPM
- work now happening in `devel` branch

## v1.0.0

- default `contextKey` value changed from `context` to `graph`

## v0.2.1

- replaces AsyncIterator instances w/ native stream.(Readable|Writable) instances
