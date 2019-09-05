
# CHANGELOG

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
