
# CHANGELOG

#### v2.1.1

- new, (hopefully) cleaner API
    - `getStream()`, `putStream()` and `delStream()` methods
    - `query.get()`, `query().del()` methods
- less code duplication
- `master` branch now tracking NPM
- work now happening in `devel` branch

#### v1.0.0

- default `contextKey` value changed from `context` to `graph`

#### v0.2.1

- replaces AsyncIterator instances w/ native stream.(Readable|Writable) instances
