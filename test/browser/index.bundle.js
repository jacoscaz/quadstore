/******/ var __webpack_modules__ = ({

/***/ "../../node_modules/abstract-level/abstract-chained-batch.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { fromCallback } = __webpack_require__("../../node_modules/catering/index.js")
const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const { getCallback, getOptions } = __webpack_require__("../../node_modules/abstract-level/lib/common.js")

const kPromise = Symbol('promise')
const kStatus = Symbol('status')
const kOperations = Symbol('operations')
const kFinishClose = Symbol('finishClose')
const kCloseCallbacks = Symbol('closeCallbacks')

class AbstractChainedBatch {
  constructor (db) {
    if (typeof db !== 'object' || db === null) {
      const hint = db === null ? 'null' : typeof db
      throw new TypeError(`The first argument must be an abstract-level database, received ${hint}`)
    }

    this[kOperations] = []
    this[kCloseCallbacks] = []
    this[kStatus] = 'open'
    this[kFinishClose] = this[kFinishClose].bind(this)

    this.db = db
    this.db.attachResource(this)
    this.nextTick = db.nextTick
  }

  get length () {
    return this[kOperations].length
  }

  put (key, value, options) {
    if (this[kStatus] !== 'open') {
      throw new ModuleError('Batch is not open: cannot call put() after write() or close()', {
        code: 'LEVEL_BATCH_NOT_OPEN'
      })
    }

    const err = this.db._checkKey(key) || this.db._checkValue(value)
    if (err) throw err

    const db = options && options.sublevel != null ? options.sublevel : this.db
    const original = options
    const keyEncoding = db.keyEncoding(options && options.keyEncoding)
    const valueEncoding = db.valueEncoding(options && options.valueEncoding)
    const keyFormat = keyEncoding.format

    // Forward encoding options
    options = { ...options, keyEncoding: keyFormat, valueEncoding: valueEncoding.format }

    // Prevent double prefixing
    if (db !== this.db) {
      options.sublevel = null
    }

    const mappedKey = db.prefixKey(keyEncoding.encode(key), keyFormat)
    const mappedValue = valueEncoding.encode(value)

    this._put(mappedKey, mappedValue, options)
    this[kOperations].push({ ...original, type: 'put', key, value })

    return this
  }

  _put (key, value, options) {}

  del (key, options) {
    if (this[kStatus] !== 'open') {
      throw new ModuleError('Batch is not open: cannot call del() after write() or close()', {
        code: 'LEVEL_BATCH_NOT_OPEN'
      })
    }

    const err = this.db._checkKey(key)
    if (err) throw err

    const db = options && options.sublevel != null ? options.sublevel : this.db
    const original = options
    const keyEncoding = db.keyEncoding(options && options.keyEncoding)
    const keyFormat = keyEncoding.format

    // Forward encoding options
    options = { ...options, keyEncoding: keyFormat }

    // Prevent double prefixing
    if (db !== this.db) {
      options.sublevel = null
    }

    this._del(db.prefixKey(keyEncoding.encode(key), keyFormat), options)
    this[kOperations].push({ ...original, type: 'del', key })

    return this
  }

  _del (key, options) {}

  clear () {
    if (this[kStatus] !== 'open') {
      throw new ModuleError('Batch is not open: cannot call clear() after write() or close()', {
        code: 'LEVEL_BATCH_NOT_OPEN'
      })
    }

    this._clear()
    this[kOperations] = []

    return this
  }

  _clear () {}

  write (options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options)

    if (this[kStatus] !== 'open') {
      this.nextTick(callback, new ModuleError('Batch is not open: cannot call write() after write() or close()', {
        code: 'LEVEL_BATCH_NOT_OPEN'
      }))
    } else if (this.length === 0) {
      this.close(callback)
    } else {
      this[kStatus] = 'writing'
      this._write(options, (err) => {
        this[kStatus] = 'closing'
        this[kCloseCallbacks].push(() => callback(err))

        // Emit after setting 'closing' status, because event may trigger a
        // db close which in turn triggers (idempotently) closing this batch.
        if (!err) this.db.emit('batch', this[kOperations])

        this._close(this[kFinishClose])
      })
    }

    return callback[kPromise]
  }

  _write (options, callback) {}

  close (callback) {
    callback = fromCallback(callback, kPromise)

    if (this[kStatus] === 'closing') {
      this[kCloseCallbacks].push(callback)
    } else if (this[kStatus] === 'closed') {
      this.nextTick(callback)
    } else {
      this[kCloseCallbacks].push(callback)

      if (this[kStatus] !== 'writing') {
        this[kStatus] = 'closing'
        this._close(this[kFinishClose])
      }
    }

    return callback[kPromise]
  }

  _close (callback) {
    this.nextTick(callback)
  }

  [kFinishClose] () {
    this[kStatus] = 'closed'
    this.db.detachResource(this)

    const callbacks = this[kCloseCallbacks]
    this[kCloseCallbacks] = []

    for (const cb of callbacks) {
      cb()
    }
  }
}

exports.AbstractChainedBatch = AbstractChainedBatch


/***/ }),

/***/ "../../node_modules/abstract-level/abstract-iterator.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { fromCallback } = __webpack_require__("../../node_modules/catering/index.js")
const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const { getOptions, getCallback } = __webpack_require__("../../node_modules/abstract-level/lib/common.js")

const kPromise = Symbol('promise')
const kCallback = Symbol('callback')
const kWorking = Symbol('working')
const kHandleOne = Symbol('handleOne')
const kHandleMany = Symbol('handleMany')
const kAutoClose = Symbol('autoClose')
const kFinishWork = Symbol('finishWork')
const kReturnMany = Symbol('returnMany')
const kClosing = Symbol('closing')
const kHandleClose = Symbol('handleClose')
const kClosed = Symbol('closed')
const kCloseCallbacks = Symbol('closeCallbacks')
const kKeyEncoding = Symbol('keyEncoding')
const kValueEncoding = Symbol('valueEncoding')
const kAbortOnClose = Symbol('abortOnClose')
const kLegacy = Symbol('legacy')
const kKeys = Symbol('keys')
const kValues = Symbol('values')
const kLimit = Symbol('limit')
const kCount = Symbol('count')

const emptyOptions = Object.freeze({})
const noop = () => {}
let warnedEnd = false

// This class is an internal utility for common functionality between AbstractIterator,
// AbstractKeyIterator and AbstractValueIterator. It's not exported.
class CommonIterator {
  constructor (db, options, legacy) {
    if (typeof db !== 'object' || db === null) {
      const hint = db === null ? 'null' : typeof db
      throw new TypeError(`The first argument must be an abstract-level database, received ${hint}`)
    }

    if (typeof options !== 'object' || options === null) {
      throw new TypeError('The second argument must be an options object')
    }

    this[kClosed] = false
    this[kCloseCallbacks] = []
    this[kWorking] = false
    this[kClosing] = false
    this[kAutoClose] = false
    this[kCallback] = null
    this[kHandleOne] = this[kHandleOne].bind(this)
    this[kHandleMany] = this[kHandleMany].bind(this)
    this[kHandleClose] = this[kHandleClose].bind(this)
    this[kKeyEncoding] = options[kKeyEncoding]
    this[kValueEncoding] = options[kValueEncoding]
    this[kLegacy] = legacy
    this[kLimit] = Number.isInteger(options.limit) && options.limit >= 0 ? options.limit : Infinity
    this[kCount] = 0

    // Undocumented option to abort pending work on close(). Used by the
    // many-level module as a temporary solution to a blocked close().
    // TODO (next major): consider making this the default behavior. Native
    // implementations should have their own logic to safely close iterators.
    this[kAbortOnClose] = !!options.abortOnClose

    this.db = db
    this.db.attachResource(this)
    this.nextTick = db.nextTick
  }

  get count () {
    return this[kCount]
  }

  get limit () {
    return this[kLimit]
  }

  next (callback) {
    let promise

    if (callback === undefined) {
      promise = new Promise((resolve, reject) => {
        callback = (err, key, value) => {
          if (err) reject(err)
          else if (!this[kLegacy]) resolve(key)
          else if (key === undefined && value === undefined) resolve()
          else resolve([key, value])
        }
      })
    } else if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function')
    }

    if (this[kClosing]) {
      this.nextTick(callback, new ModuleError('Iterator is not open: cannot call next() after close()', {
        code: 'LEVEL_ITERATOR_NOT_OPEN'
      }))
    } else if (this[kWorking]) {
      this.nextTick(callback, new ModuleError('Iterator is busy: cannot call next() until previous call has completed', {
        code: 'LEVEL_ITERATOR_BUSY'
      }))
    } else {
      this[kWorking] = true
      this[kCallback] = callback

      if (this[kCount] >= this[kLimit]) this.nextTick(this[kHandleOne], null)
      else this._next(this[kHandleOne])
    }

    return promise
  }

  _next (callback) {
    this.nextTick(callback)
  }

  nextv (size, options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, emptyOptions)

    if (!Number.isInteger(size)) {
      this.nextTick(callback, new TypeError("The first argument 'size' must be an integer"))
      return callback[kPromise]
    }

    if (this[kClosing]) {
      this.nextTick(callback, new ModuleError('Iterator is not open: cannot call nextv() after close()', {
        code: 'LEVEL_ITERATOR_NOT_OPEN'
      }))
    } else if (this[kWorking]) {
      this.nextTick(callback, new ModuleError('Iterator is busy: cannot call nextv() until previous call has completed', {
        code: 'LEVEL_ITERATOR_BUSY'
      }))
    } else {
      if (size < 1) size = 1
      if (this[kLimit] < Infinity) size = Math.min(size, this[kLimit] - this[kCount])

      this[kWorking] = true
      this[kCallback] = callback

      if (size <= 0) this.nextTick(this[kHandleMany], null, [])
      else this._nextv(size, options, this[kHandleMany])
    }

    return callback[kPromise]
  }

  _nextv (size, options, callback) {
    const acc = []
    const onnext = (err, key, value) => {
      if (err) {
        return callback(err)
      } else if (this[kLegacy] ? key === undefined && value === undefined : key === undefined) {
        return callback(null, acc)
      }

      acc.push(this[kLegacy] ? [key, value] : key)

      if (acc.length === size) {
        callback(null, acc)
      } else {
        this._next(onnext)
      }
    }

    this._next(onnext)
  }

  all (options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, emptyOptions)

    if (this[kClosing]) {
      this.nextTick(callback, new ModuleError('Iterator is not open: cannot call all() after close()', {
        code: 'LEVEL_ITERATOR_NOT_OPEN'
      }))
    } else if (this[kWorking]) {
      this.nextTick(callback, new ModuleError('Iterator is busy: cannot call all() until previous call has completed', {
        code: 'LEVEL_ITERATOR_BUSY'
      }))
    } else {
      this[kWorking] = true
      this[kCallback] = callback
      this[kAutoClose] = true

      if (this[kCount] >= this[kLimit]) this.nextTick(this[kHandleMany], null, [])
      else this._all(options, this[kHandleMany])
    }

    return callback[kPromise]
  }

  _all (options, callback) {
    // Must count here because we're directly calling _nextv()
    let count = this[kCount]
    const acc = []

    const nextv = () => {
      // Not configurable, because implementations should optimize _all().
      const size = this[kLimit] < Infinity ? Math.min(1e3, this[kLimit] - count) : 1e3

      if (size <= 0) {
        this.nextTick(callback, null, acc)
      } else {
        this._nextv(size, emptyOptions, onnextv)
      }
    }

    const onnextv = (err, items) => {
      if (err) {
        callback(err)
      } else if (items.length === 0) {
        callback(null, acc)
      } else {
        acc.push.apply(acc, items)
        count += items.length
        nextv()
      }
    }

    nextv()
  }

  [kFinishWork] () {
    const cb = this[kCallback]

    // Callback will be null if work was aborted on close
    if (this[kAbortOnClose] && cb === null) return noop

    this[kWorking] = false
    this[kCallback] = null

    if (this[kClosing]) this._close(this[kHandleClose])

    return cb
  }

  [kReturnMany] (cb, err, items) {
    if (this[kAutoClose]) {
      this.close(cb.bind(null, err, items))
    } else {
      cb(err, items)
    }
  }

  seek (target, options) {
    options = getOptions(options, emptyOptions)

    if (this[kClosing]) {
      // Don't throw here, to be kind to implementations that wrap
      // another db and don't necessarily control when the db is closed
    } else if (this[kWorking]) {
      throw new ModuleError('Iterator is busy: cannot call seek() until next() has completed', {
        code: 'LEVEL_ITERATOR_BUSY'
      })
    } else {
      const keyEncoding = this.db.keyEncoding(options.keyEncoding || this[kKeyEncoding])
      const keyFormat = keyEncoding.format

      if (options.keyEncoding !== keyFormat) {
        options = { ...options, keyEncoding: keyFormat }
      }

      const mapped = this.db.prefixKey(keyEncoding.encode(target), keyFormat)
      this._seek(mapped, options)
    }
  }

  _seek (target, options) {
    throw new ModuleError('Iterator does not support seek()', {
      code: 'LEVEL_NOT_SUPPORTED'
    })
  }

  close (callback) {
    callback = fromCallback(callback, kPromise)

    if (this[kClosed]) {
      this.nextTick(callback)
    } else if (this[kClosing]) {
      this[kCloseCallbacks].push(callback)
    } else {
      this[kClosing] = true
      this[kCloseCallbacks].push(callback)

      if (!this[kWorking]) {
        this._close(this[kHandleClose])
      } else if (this[kAbortOnClose]) {
        // Don't wait for work to finish. Subsequently ignore the result.
        const cb = this[kFinishWork]()

        cb(new ModuleError('Aborted on iterator close()', {
          code: 'LEVEL_ITERATOR_NOT_OPEN'
        }))
      }
    }

    return callback[kPromise]
  }

  _close (callback) {
    this.nextTick(callback)
  }

  [kHandleClose] () {
    this[kClosed] = true
    this.db.detachResource(this)

    const callbacks = this[kCloseCallbacks]
    this[kCloseCallbacks] = []

    for (const cb of callbacks) {
      cb()
    }
  }

  async * [Symbol.asyncIterator] () {
    try {
      let item

      while ((item = (await this.next())) !== undefined) {
        yield item
      }
    } finally {
      if (!this[kClosed]) await this.close()
    }
  }
}

// For backwards compatibility this class is not (yet) called AbstractEntryIterator.
class AbstractIterator extends CommonIterator {
  constructor (db, options) {
    super(db, options, true)
    this[kKeys] = options.keys !== false
    this[kValues] = options.values !== false
  }

  [kHandleOne] (err, key, value) {
    const cb = this[kFinishWork]()
    if (err) return cb(err)

    try {
      key = this[kKeys] && key !== undefined ? this[kKeyEncoding].decode(key) : undefined
      value = this[kValues] && value !== undefined ? this[kValueEncoding].decode(value) : undefined
    } catch (err) {
      return cb(new IteratorDecodeError('entry', err))
    }

    if (!(key === undefined && value === undefined)) {
      this[kCount]++
    }

    cb(null, key, value)
  }

  [kHandleMany] (err, entries) {
    const cb = this[kFinishWork]()
    if (err) return this[kReturnMany](cb, err)

    try {
      for (const entry of entries) {
        const key = entry[0]
        const value = entry[1]

        entry[0] = this[kKeys] && key !== undefined ? this[kKeyEncoding].decode(key) : undefined
        entry[1] = this[kValues] && value !== undefined ? this[kValueEncoding].decode(value) : undefined
      }
    } catch (err) {
      return this[kReturnMany](cb, new IteratorDecodeError('entries', err))
    }

    this[kCount] += entries.length
    this[kReturnMany](cb, null, entries)
  }

  end (callback) {
    if (!warnedEnd && typeof console !== 'undefined') {
      warnedEnd = true
      console.warn(new ModuleError(
        'The iterator.end() method was renamed to close() and end() is an alias that will be removed in a future version',
        { code: 'LEVEL_LEGACY' }
      ))
    }

    return this.close(callback)
  }
}

class AbstractKeyIterator extends CommonIterator {
  constructor (db, options) {
    super(db, options, false)
  }

  [kHandleOne] (err, key) {
    const cb = this[kFinishWork]()
    if (err) return cb(err)

    try {
      key = key !== undefined ? this[kKeyEncoding].decode(key) : undefined
    } catch (err) {
      return cb(new IteratorDecodeError('key', err))
    }

    if (key !== undefined) this[kCount]++
    cb(null, key)
  }

  [kHandleMany] (err, keys) {
    const cb = this[kFinishWork]()
    if (err) return this[kReturnMany](cb, err)

    try {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        keys[i] = key !== undefined ? this[kKeyEncoding].decode(key) : undefined
      }
    } catch (err) {
      return this[kReturnMany](cb, new IteratorDecodeError('keys', err))
    }

    this[kCount] += keys.length
    this[kReturnMany](cb, null, keys)
  }
}

class AbstractValueIterator extends CommonIterator {
  constructor (db, options) {
    super(db, options, false)
  }

  [kHandleOne] (err, value) {
    const cb = this[kFinishWork]()
    if (err) return cb(err)

    try {
      value = value !== undefined ? this[kValueEncoding].decode(value) : undefined
    } catch (err) {
      return cb(new IteratorDecodeError('value', err))
    }

    if (value !== undefined) this[kCount]++
    cb(null, value)
  }

  [kHandleMany] (err, values) {
    const cb = this[kFinishWork]()
    if (err) return this[kReturnMany](cb, err)

    try {
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        values[i] = value !== undefined ? this[kValueEncoding].decode(value) : undefined
      }
    } catch (err) {
      return this[kReturnMany](cb, new IteratorDecodeError('values', err))
    }

    this[kCount] += values.length
    this[kReturnMany](cb, null, values)
  }
}

// Internal utility, not typed or exported
class IteratorDecodeError extends ModuleError {
  constructor (subject, cause) {
    super(`Iterator could not decode ${subject}`, {
      code: 'LEVEL_DECODE_ERROR',
      cause
    })
  }
}

// To help migrating to abstract-level
for (const k of ['_ended property', '_nexting property', '_end method']) {
  Object.defineProperty(AbstractIterator.prototype, k.split(' ')[0], {
    get () { throw new ModuleError(`The ${k} has been removed`, { code: 'LEVEL_LEGACY' }) },
    set () { throw new ModuleError(`The ${k} has been removed`, { code: 'LEVEL_LEGACY' }) }
  })
}

// Exposed so that AbstractLevel can set these options
AbstractIterator.keyEncoding = kKeyEncoding
AbstractIterator.valueEncoding = kValueEncoding

exports.AbstractIterator = AbstractIterator
exports.AbstractKeyIterator = AbstractKeyIterator
exports.AbstractValueIterator = AbstractValueIterator


/***/ }),

/***/ "../../node_modules/abstract-level/abstract-level.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { supports } = __webpack_require__("../../node_modules/abstract-level/node_modules/level-supports/index.js")
const { Transcoder } = __webpack_require__("../../node_modules/level-transcoder/index.js")
const { EventEmitter } = __webpack_require__("../../node_modules/events/events.js")
const { fromCallback } = __webpack_require__("../../node_modules/catering/index.js")
const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const { AbstractIterator } = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js")
const { DefaultKeyIterator, DefaultValueIterator } = __webpack_require__("../../node_modules/abstract-level/lib/default-kv-iterator.js")
const { DeferredIterator, DeferredKeyIterator, DeferredValueIterator } = __webpack_require__("../../node_modules/abstract-level/lib/deferred-iterator.js")
const { DefaultChainedBatch } = __webpack_require__("../../node_modules/abstract-level/lib/default-chained-batch.js")
const { getCallback, getOptions } = __webpack_require__("../../node_modules/abstract-level/lib/common.js")
const rangeOptions = __webpack_require__("../../node_modules/abstract-level/lib/range-options.js")

const kPromise = Symbol('promise')
const kLanded = Symbol('landed')
const kResources = Symbol('resources')
const kCloseResources = Symbol('closeResources')
const kOperations = Symbol('operations')
const kUndefer = Symbol('undefer')
const kDeferOpen = Symbol('deferOpen')
const kOptions = Symbol('options')
const kStatus = Symbol('status')
const kDefaultOptions = Symbol('defaultOptions')
const kTranscoder = Symbol('transcoder')
const kKeyEncoding = Symbol('keyEncoding')
const kValueEncoding = Symbol('valueEncoding')
const noop = () => {}

class AbstractLevel extends EventEmitter {
  constructor (manifest, options) {
    super()

    if (typeof manifest !== 'object' || manifest === null) {
      throw new TypeError("The first argument 'manifest' must be an object")
    }

    options = getOptions(options)
    const { keyEncoding, valueEncoding, passive, ...forward } = options

    this[kResources] = new Set()
    this[kOperations] = []
    this[kDeferOpen] = true
    this[kOptions] = forward
    this[kStatus] = 'opening'

    this.supports = supports(manifest, {
      status: true,
      promises: true,
      clear: true,
      getMany: true,
      deferredOpen: true,

      // TODO (next major): add seek
      snapshots: manifest.snapshots !== false,
      permanence: manifest.permanence !== false,

      // TODO: remove from level-supports because it's always supported
      keyIterator: true,
      valueIterator: true,
      iteratorNextv: true,
      iteratorAll: true,

      encodings: manifest.encodings || {},
      events: Object.assign({}, manifest.events, {
        opening: true,
        open: true,
        closing: true,
        closed: true,
        put: true,
        del: true,
        batch: true,
        clear: true
      })
    })

    this[kTranscoder] = new Transcoder(formats(this))
    this[kKeyEncoding] = this[kTranscoder].encoding(keyEncoding || 'utf8')
    this[kValueEncoding] = this[kTranscoder].encoding(valueEncoding || 'utf8')

    // Add custom and transcoder encodings to manifest
    for (const encoding of this[kTranscoder].encodings()) {
      if (!this.supports.encodings[encoding.commonName]) {
        this.supports.encodings[encoding.commonName] = true
      }
    }

    this[kDefaultOptions] = {
      empty: Object.freeze({}),
      entry: Object.freeze({
        keyEncoding: this[kKeyEncoding].commonName,
        valueEncoding: this[kValueEncoding].commonName
      }),
      key: Object.freeze({
        keyEncoding: this[kKeyEncoding].commonName
      })
    }

    // Let subclass finish its constructor
    this.nextTick(() => {
      if (this[kDeferOpen]) {
        this.open({ passive: false }, noop)
      }
    })
  }

  get status () {
    return this[kStatus]
  }

  keyEncoding (encoding) {
    return this[kTranscoder].encoding(encoding != null ? encoding : this[kKeyEncoding])
  }

  valueEncoding (encoding) {
    return this[kTranscoder].encoding(encoding != null ? encoding : this[kValueEncoding])
  }

  open (options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)

    options = { ...this[kOptions], ...getOptions(options) }

    options.createIfMissing = options.createIfMissing !== false
    options.errorIfExists = !!options.errorIfExists

    const maybeOpened = (err) => {
      if (this[kStatus] === 'closing' || this[kStatus] === 'opening') {
        // Wait until pending state changes are done
        this.once(kLanded, err ? () => maybeOpened(err) : maybeOpened)
      } else if (this[kStatus] !== 'open') {
        callback(new ModuleError('Database is not open', {
          code: 'LEVEL_DATABASE_NOT_OPEN',
          cause: err
        }))
      } else {
        callback()
      }
    }

    if (options.passive) {
      if (this[kStatus] === 'opening') {
        this.once(kLanded, maybeOpened)
      } else {
        this.nextTick(maybeOpened)
      }
    } else if (this[kStatus] === 'closed' || this[kDeferOpen]) {
      this[kDeferOpen] = false
      this[kStatus] = 'opening'
      this.emit('opening')

      this._open(options, (err) => {
        if (err) {
          this[kStatus] = 'closed'

          // Resources must be safe to close in any db state
          this[kCloseResources](() => {
            this.emit(kLanded)
            maybeOpened(err)
          })

          this[kUndefer]()
          return
        }

        this[kStatus] = 'open'
        this[kUndefer]()
        this.emit(kLanded)

        // Only emit public event if pending state changes are done
        if (this[kStatus] === 'open') this.emit('open')

        // TODO (next major): remove this alias
        if (this[kStatus] === 'open') this.emit('ready')

        maybeOpened()
      })
    } else if (this[kStatus] === 'open') {
      this.nextTick(maybeOpened)
    } else {
      this.once(kLanded, () => this.open(options, callback))
    }

    return callback[kPromise]
  }

  _open (options, callback) {
    this.nextTick(callback)
  }

  close (callback) {
    callback = fromCallback(callback, kPromise)

    const maybeClosed = (err) => {
      if (this[kStatus] === 'opening' || this[kStatus] === 'closing') {
        // Wait until pending state changes are done
        this.once(kLanded, err ? maybeClosed(err) : maybeClosed)
      } else if (this[kStatus] !== 'closed') {
        callback(new ModuleError('Database is not closed', {
          code: 'LEVEL_DATABASE_NOT_CLOSED',
          cause: err
        }))
      } else {
        callback()
      }
    }

    if (this[kStatus] === 'open') {
      this[kStatus] = 'closing'
      this.emit('closing')

      const cancel = (err) => {
        this[kStatus] = 'open'
        this[kUndefer]()
        this.emit(kLanded)
        maybeClosed(err)
      }

      this[kCloseResources](() => {
        this._close((err) => {
          if (err) return cancel(err)

          this[kStatus] = 'closed'
          this[kUndefer]()
          this.emit(kLanded)

          // Only emit public event if pending state changes are done
          if (this[kStatus] === 'closed') this.emit('closed')

          maybeClosed()
        })
      })
    } else if (this[kStatus] === 'closed') {
      this.nextTick(maybeClosed)
    } else {
      this.once(kLanded, () => this.close(callback))
    }

    return callback[kPromise]
  }

  [kCloseResources] (callback) {
    if (this[kResources].size === 0) {
      return this.nextTick(callback)
    }

    let pending = this[kResources].size
    let sync = true

    const next = () => {
      if (--pending === 0) {
        // We don't have tests for generic resources, so dezalgo
        if (sync) this.nextTick(callback)
        else callback()
      }
    }

    // In parallel so that all resources know they are closed
    for (const resource of this[kResources]) {
      resource.close(next)
    }

    sync = false
    this[kResources].clear()
  }

  _close (callback) {
    this.nextTick(callback)
  }

  get (key, options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, this[kDefaultOptions].entry)

    if (this[kStatus] === 'opening') {
      this.defer(() => this.get(key, options, callback))
      return callback[kPromise]
    }

    if (maybeError(this, callback)) {
      return callback[kPromise]
    }

    const err = this._checkKey(key)

    if (err) {
      this.nextTick(callback, err)
      return callback[kPromise]
    }

    const keyEncoding = this.keyEncoding(options.keyEncoding)
    const valueEncoding = this.valueEncoding(options.valueEncoding)
    const keyFormat = keyEncoding.format
    const valueFormat = valueEncoding.format

    // Forward encoding options to the underlying store
    if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
      // Avoid spread operator because of https://bugs.chromium.org/p/chromium/issues/detail?id=1204540
      options = Object.assign({}, options, { keyEncoding: keyFormat, valueEncoding: valueFormat })
    }

    this._get(this.prefixKey(keyEncoding.encode(key), keyFormat), options, (err, value) => {
      if (err) {
        // Normalize not found error for backwards compatibility with abstract-leveldown and level(up)
        if (err.code === 'LEVEL_NOT_FOUND' || err.notFound || /NotFound/i.test(err)) {
          if (!err.code) err.code = 'LEVEL_NOT_FOUND' // Preferred way going forward
          if (!err.notFound) err.notFound = true // Same as level-errors
          if (!err.status) err.status = 404 // Same as level-errors
        }

        return callback(err)
      }

      try {
        value = valueEncoding.decode(value)
      } catch (err) {
        return callback(new ModuleError('Could not decode value', {
          code: 'LEVEL_DECODE_ERROR',
          cause: err
        }))
      }

      callback(null, value)
    })

    return callback[kPromise]
  }

  _get (key, options, callback) {
    this.nextTick(callback, new Error('NotFound'))
  }

  getMany (keys, options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, this[kDefaultOptions].entry)

    if (this[kStatus] === 'opening') {
      this.defer(() => this.getMany(keys, options, callback))
      return callback[kPromise]
    }

    if (maybeError(this, callback)) {
      return callback[kPromise]
    }

    if (!Array.isArray(keys)) {
      this.nextTick(callback, new TypeError("The first argument 'keys' must be an array"))
      return callback[kPromise]
    }

    if (keys.length === 0) {
      this.nextTick(callback, null, [])
      return callback[kPromise]
    }

    const keyEncoding = this.keyEncoding(options.keyEncoding)
    const valueEncoding = this.valueEncoding(options.valueEncoding)
    const keyFormat = keyEncoding.format
    const valueFormat = valueEncoding.format

    // Forward encoding options
    if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
      options = Object.assign({}, options, { keyEncoding: keyFormat, valueEncoding: valueFormat })
    }

    const mappedKeys = new Array(keys.length)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const err = this._checkKey(key)

      if (err) {
        this.nextTick(callback, err)
        return callback[kPromise]
      }

      mappedKeys[i] = this.prefixKey(keyEncoding.encode(key), keyFormat)
    }

    this._getMany(mappedKeys, options, (err, values) => {
      if (err) return callback(err)

      try {
        for (let i = 0; i < values.length; i++) {
          if (values[i] !== undefined) {
            values[i] = valueEncoding.decode(values[i])
          }
        }
      } catch (err) {
        return callback(new ModuleError(`Could not decode one or more of ${values.length} value(s)`, {
          code: 'LEVEL_DECODE_ERROR',
          cause: err
        }))
      }

      callback(null, values)
    })

    return callback[kPromise]
  }

  _getMany (keys, options, callback) {
    this.nextTick(callback, null, new Array(keys.length).fill(undefined))
  }

  put (key, value, options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, this[kDefaultOptions].entry)

    if (this[kStatus] === 'opening') {
      this.defer(() => this.put(key, value, options, callback))
      return callback[kPromise]
    }

    if (maybeError(this, callback)) {
      return callback[kPromise]
    }

    const err = this._checkKey(key) || this._checkValue(value)

    if (err) {
      this.nextTick(callback, err)
      return callback[kPromise]
    }

    const keyEncoding = this.keyEncoding(options.keyEncoding)
    const valueEncoding = this.valueEncoding(options.valueEncoding)
    const keyFormat = keyEncoding.format
    const valueFormat = valueEncoding.format

    // Forward encoding options
    if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
      options = Object.assign({}, options, { keyEncoding: keyFormat, valueEncoding: valueFormat })
    }

    const mappedKey = this.prefixKey(keyEncoding.encode(key), keyFormat)
    const mappedValue = valueEncoding.encode(value)

    this._put(mappedKey, mappedValue, options, (err) => {
      if (err) return callback(err)
      this.emit('put', key, value)
      callback()
    })

    return callback[kPromise]
  }

  _put (key, value, options, callback) {
    this.nextTick(callback)
  }

  del (key, options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, this[kDefaultOptions].key)

    if (this[kStatus] === 'opening') {
      this.defer(() => this.del(key, options, callback))
      return callback[kPromise]
    }

    if (maybeError(this, callback)) {
      return callback[kPromise]
    }

    const err = this._checkKey(key)

    if (err) {
      this.nextTick(callback, err)
      return callback[kPromise]
    }

    const keyEncoding = this.keyEncoding(options.keyEncoding)
    const keyFormat = keyEncoding.format

    // Forward encoding options
    if (options.keyEncoding !== keyFormat) {
      options = Object.assign({}, options, { keyEncoding: keyFormat })
    }

    this._del(this.prefixKey(keyEncoding.encode(key), keyFormat), options, (err) => {
      if (err) return callback(err)
      this.emit('del', key)
      callback()
    })

    return callback[kPromise]
  }

  _del (key, options, callback) {
    this.nextTick(callback)
  }

  batch (operations, options, callback) {
    if (!arguments.length) {
      if (this[kStatus] === 'opening') return new DefaultChainedBatch(this)
      if (this[kStatus] !== 'open') {
        throw new ModuleError('Database is not open', {
          code: 'LEVEL_DATABASE_NOT_OPEN'
        })
      }
      return this._chainedBatch()
    }

    if (typeof operations === 'function') callback = operations
    else callback = getCallback(options, callback)

    callback = fromCallback(callback, kPromise)
    options = getOptions(options, this[kDefaultOptions].empty)

    if (this[kStatus] === 'opening') {
      this.defer(() => this.batch(operations, options, callback))
      return callback[kPromise]
    }

    if (maybeError(this, callback)) {
      return callback[kPromise]
    }

    if (!Array.isArray(operations)) {
      this.nextTick(callback, new TypeError("The first argument 'operations' must be an array"))
      return callback[kPromise]
    }

    if (operations.length === 0) {
      this.nextTick(callback)
      return callback[kPromise]
    }

    const mapped = new Array(operations.length)
    const { keyEncoding: ke, valueEncoding: ve, ...forward } = options

    for (let i = 0; i < operations.length; i++) {
      if (typeof operations[i] !== 'object' || operations[i] === null) {
        this.nextTick(callback, new TypeError('A batch operation must be an object'))
        return callback[kPromise]
      }

      const op = Object.assign({}, operations[i])

      if (op.type !== 'put' && op.type !== 'del') {
        this.nextTick(callback, new TypeError("A batch operation must have a type property that is 'put' or 'del'"))
        return callback[kPromise]
      }

      const err = this._checkKey(op.key)

      if (err) {
        this.nextTick(callback, err)
        return callback[kPromise]
      }

      const db = op.sublevel != null ? op.sublevel : this
      const keyEncoding = db.keyEncoding(op.keyEncoding || ke)
      const keyFormat = keyEncoding.format

      op.key = db.prefixKey(keyEncoding.encode(op.key), keyFormat)
      op.keyEncoding = keyFormat

      if (op.type === 'put') {
        const valueErr = this._checkValue(op.value)

        if (valueErr) {
          this.nextTick(callback, valueErr)
          return callback[kPromise]
        }

        const valueEncoding = db.valueEncoding(op.valueEncoding || ve)

        op.value = valueEncoding.encode(op.value)
        op.valueEncoding = valueEncoding.format
      }

      // Prevent double prefixing
      if (db !== this) {
        op.sublevel = null
      }

      mapped[i] = op
    }

    this._batch(mapped, forward, (err) => {
      if (err) return callback(err)
      this.emit('batch', operations)
      callback()
    })

    return callback[kPromise]
  }

  _batch (operations, options, callback) {
    this.nextTick(callback)
  }

  sublevel (name, options) {
    return this._sublevel(name, AbstractSublevel.defaults(options))
  }

  _sublevel (name, options) {
    return new AbstractSublevel(this, name, options)
  }

  prefixKey (key, keyFormat) {
    return key
  }

  clear (options, callback) {
    callback = getCallback(options, callback)
    callback = fromCallback(callback, kPromise)
    options = getOptions(options, this[kDefaultOptions].empty)

    if (this[kStatus] === 'opening') {
      this.defer(() => this.clear(options, callback))
      return callback[kPromise]
    }

    if (maybeError(this, callback)) {
      return callback[kPromise]
    }

    const original = options
    const keyEncoding = this.keyEncoding(options.keyEncoding)

    options = rangeOptions(options, keyEncoding)
    options.keyEncoding = keyEncoding.format

    if (options.limit === 0) {
      this.nextTick(callback)
    } else {
      this._clear(options, (err) => {
        if (err) return callback(err)
        this.emit('clear', original)
        callback()
      })
    }

    return callback[kPromise]
  }

  _clear (options, callback) {
    this.nextTick(callback)
  }

  iterator (options) {
    const keyEncoding = this.keyEncoding(options && options.keyEncoding)
    const valueEncoding = this.valueEncoding(options && options.valueEncoding)

    options = rangeOptions(options, keyEncoding)
    options.keys = options.keys !== false
    options.values = options.values !== false

    // We need the original encoding options in AbstractIterator in order to decode data
    options[AbstractIterator.keyEncoding] = keyEncoding
    options[AbstractIterator.valueEncoding] = valueEncoding

    // Forward encoding options to private API
    options.keyEncoding = keyEncoding.format
    options.valueEncoding = valueEncoding.format

    if (this[kStatus] === 'opening') {
      return new DeferredIterator(this, options)
    } else if (this[kStatus] !== 'open') {
      throw new ModuleError('Database is not open', {
        code: 'LEVEL_DATABASE_NOT_OPEN'
      })
    }

    return this._iterator(options)
  }

  _iterator (options) {
    return new AbstractIterator(this, options)
  }

  keys (options) {
    // Also include valueEncoding (though unused) because we may fallback to _iterator()
    const keyEncoding = this.keyEncoding(options && options.keyEncoding)
    const valueEncoding = this.valueEncoding(options && options.valueEncoding)

    options = rangeOptions(options, keyEncoding)

    // We need the original encoding options in AbstractKeyIterator in order to decode data
    options[AbstractIterator.keyEncoding] = keyEncoding
    options[AbstractIterator.valueEncoding] = valueEncoding

    // Forward encoding options to private API
    options.keyEncoding = keyEncoding.format
    options.valueEncoding = valueEncoding.format

    if (this[kStatus] === 'opening') {
      return new DeferredKeyIterator(this, options)
    } else if (this[kStatus] !== 'open') {
      throw new ModuleError('Database is not open', {
        code: 'LEVEL_DATABASE_NOT_OPEN'
      })
    }

    return this._keys(options)
  }

  _keys (options) {
    return new DefaultKeyIterator(this, options)
  }

  values (options) {
    const keyEncoding = this.keyEncoding(options && options.keyEncoding)
    const valueEncoding = this.valueEncoding(options && options.valueEncoding)

    options = rangeOptions(options, keyEncoding)

    // We need the original encoding options in AbstractValueIterator in order to decode data
    options[AbstractIterator.keyEncoding] = keyEncoding
    options[AbstractIterator.valueEncoding] = valueEncoding

    // Forward encoding options to private API
    options.keyEncoding = keyEncoding.format
    options.valueEncoding = valueEncoding.format

    if (this[kStatus] === 'opening') {
      return new DeferredValueIterator(this, options)
    } else if (this[kStatus] !== 'open') {
      throw new ModuleError('Database is not open', {
        code: 'LEVEL_DATABASE_NOT_OPEN'
      })
    }

    return this._values(options)
  }

  _values (options) {
    return new DefaultValueIterator(this, options)
  }

  defer (fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('The first argument must be a function')
    }

    this[kOperations].push(fn)
  }

  [kUndefer] () {
    if (this[kOperations].length === 0) {
      return
    }

    const operations = this[kOperations]
    this[kOperations] = []

    for (const op of operations) {
      op()
    }
  }

  // TODO: docs and types
  attachResource (resource) {
    if (typeof resource !== 'object' || resource === null ||
      typeof resource.close !== 'function') {
      throw new TypeError('The first argument must be a resource object')
    }

    this[kResources].add(resource)
  }

  // TODO: docs and types
  detachResource (resource) {
    this[kResources].delete(resource)
  }

  _chainedBatch () {
    return new DefaultChainedBatch(this)
  }

  _checkKey (key) {
    if (key === null || key === undefined) {
      return new ModuleError('Key cannot be null or undefined', {
        code: 'LEVEL_INVALID_KEY'
      })
    }
  }

  _checkValue (value) {
    if (value === null || value === undefined) {
      return new ModuleError('Value cannot be null or undefined', {
        code: 'LEVEL_INVALID_VALUE'
      })
    }
  }
}

// Expose browser-compatible nextTick for dependents
// TODO: after we drop node 10, also use queueMicrotask in node
AbstractLevel.prototype.nextTick = __webpack_require__("../../node_modules/abstract-level/lib/next-tick-browser.js")

const { AbstractSublevel } = __webpack_require__("../../node_modules/abstract-level/lib/abstract-sublevel.js")({ AbstractLevel })

exports.AbstractLevel = AbstractLevel
exports.AbstractSublevel = AbstractSublevel

const maybeError = function (db, callback) {
  if (db[kStatus] !== 'open') {
    db.nextTick(callback, new ModuleError('Database is not open', {
      code: 'LEVEL_DATABASE_NOT_OPEN'
    }))
    return true
  }

  return false
}

const formats = function (db) {
  return Object.keys(db.supports.encodings)
    .filter(k => !!db.supports.encodings[k])
}


/***/ }),

/***/ "../../node_modules/abstract-level/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



exports.AbstractLevel = __webpack_require__("../../node_modules/abstract-level/abstract-level.js").AbstractLevel
exports.AbstractSublevel = __webpack_require__("../../node_modules/abstract-level/abstract-level.js").AbstractSublevel
exports.AbstractIterator = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js").AbstractIterator
exports.AbstractKeyIterator = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js").AbstractKeyIterator
exports.AbstractValueIterator = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js").AbstractValueIterator
exports.AbstractChainedBatch = __webpack_require__("../../node_modules/abstract-level/abstract-chained-batch.js").AbstractChainedBatch


/***/ }),

/***/ "../../node_modules/abstract-level/lib/abstract-sublevel-iterator.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { AbstractIterator, AbstractKeyIterator, AbstractValueIterator } = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js")

const kUnfix = Symbol('unfix')
const kIterator = Symbol('iterator')
const kHandleOne = Symbol('handleOne')
const kHandleMany = Symbol('handleMany')
const kCallback = Symbol('callback')

// TODO: unfix natively if db supports it
class AbstractSublevelIterator extends AbstractIterator {
  constructor (db, options, iterator, unfix) {
    super(db, options)

    this[kIterator] = iterator
    this[kUnfix] = unfix
    this[kHandleOne] = this[kHandleOne].bind(this)
    this[kHandleMany] = this[kHandleMany].bind(this)
    this[kCallback] = null
  }

  [kHandleOne] (err, key, value) {
    const callback = this[kCallback]
    if (err) return callback(err)
    if (key !== undefined) key = this[kUnfix](key)
    callback(err, key, value)
  }

  [kHandleMany] (err, entries) {
    const callback = this[kCallback]
    if (err) return callback(err)

    for (const entry of entries) {
      const key = entry[0]
      if (key !== undefined) entry[0] = this[kUnfix](key)
    }

    callback(err, entries)
  }
}

class AbstractSublevelKeyIterator extends AbstractKeyIterator {
  constructor (db, options, iterator, unfix) {
    super(db, options)

    this[kIterator] = iterator
    this[kUnfix] = unfix
    this[kHandleOne] = this[kHandleOne].bind(this)
    this[kHandleMany] = this[kHandleMany].bind(this)
    this[kCallback] = null
  }

  [kHandleOne] (err, key) {
    const callback = this[kCallback]
    if (err) return callback(err)
    if (key !== undefined) key = this[kUnfix](key)
    callback(err, key)
  }

  [kHandleMany] (err, keys) {
    const callback = this[kCallback]
    if (err) return callback(err)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (key !== undefined) keys[i] = this[kUnfix](key)
    }

    callback(err, keys)
  }
}

class AbstractSublevelValueIterator extends AbstractValueIterator {
  constructor (db, options, iterator) {
    super(db, options)
    this[kIterator] = iterator
  }
}

for (const Iterator of [AbstractSublevelIterator, AbstractSublevelKeyIterator]) {
  Iterator.prototype._next = function (callback) {
    this[kCallback] = callback
    this[kIterator].next(this[kHandleOne])
  }

  Iterator.prototype._nextv = function (size, options, callback) {
    this[kCallback] = callback
    this[kIterator].nextv(size, options, this[kHandleMany])
  }

  Iterator.prototype._all = function (options, callback) {
    this[kCallback] = callback
    this[kIterator].all(options, this[kHandleMany])
  }
}

for (const Iterator of [AbstractSublevelValueIterator]) {
  Iterator.prototype._next = function (callback) {
    this[kIterator].next(callback)
  }

  Iterator.prototype._nextv = function (size, options, callback) {
    this[kIterator].nextv(size, options, callback)
  }

  Iterator.prototype._all = function (options, callback) {
    this[kIterator].all(options, callback)
  }
}

for (const Iterator of [AbstractSublevelIterator, AbstractSublevelKeyIterator, AbstractSublevelValueIterator]) {
  Iterator.prototype._seek = function (target, options) {
    this[kIterator].seek(target, options)
  }

  Iterator.prototype._close = function (callback) {
    this[kIterator].close(callback)
  }
}

exports.AbstractSublevelIterator = AbstractSublevelIterator
exports.AbstractSublevelKeyIterator = AbstractSublevelKeyIterator
exports.AbstractSublevelValueIterator = AbstractSublevelValueIterator


/***/ }),

/***/ "../../node_modules/abstract-level/lib/abstract-sublevel.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const { Buffer } = __webpack_require__("../../node_modules/buffer/index.js") || {}
const {
  AbstractSublevelIterator,
  AbstractSublevelKeyIterator,
  AbstractSublevelValueIterator
} = __webpack_require__("../../node_modules/abstract-level/lib/abstract-sublevel-iterator.js")

const kPrefix = Symbol('prefix')
const kUpperBound = Symbol('upperBound')
const kPrefixRange = Symbol('prefixRange')
const kParent = Symbol('parent')
const kUnfix = Symbol('unfix')

const textEncoder = new TextEncoder()
const defaults = { separator: '!' }

// Wrapped to avoid circular dependency
module.exports = function ({ AbstractLevel }) {
  class AbstractSublevel extends AbstractLevel {
    static defaults (options) {
      // To help migrating from subleveldown to abstract-level
      if (typeof options === 'string') {
        throw new ModuleError('The subleveldown string shorthand for { separator } has been removed', {
          code: 'LEVEL_LEGACY'
        })
      } else if (options && options.open) {
        throw new ModuleError('The subleveldown open option has been removed', {
          code: 'LEVEL_LEGACY'
        })
      }

      if (options == null) {
        return defaults
      } else if (!options.separator) {
        return { ...options, separator: '!' }
      } else {
        return options
      }
    }

    // TODO: add autoClose option, which if true, does parent.attachResource(this)
    constructor (db, name, options) {
      // Don't forward AbstractSublevel options to AbstractLevel
      const { separator, manifest, ...forward } = AbstractSublevel.defaults(options)
      name = trim(name, separator)

      // Reserve one character between separator and name to give us an upper bound
      const reserved = separator.charCodeAt(0) + 1
      const parent = db[kParent] || db

      // Keys should sort like ['!a!', '!a!!a!', '!a"', '!aa!', '!b!'].
      // Use ASCII for consistent length between string, Buffer and Uint8Array
      if (!textEncoder.encode(name).every(x => x > reserved && x < 127)) {
        throw new ModuleError(`Prefix must use bytes > ${reserved} < ${127}`, {
          code: 'LEVEL_INVALID_PREFIX'
        })
      }

      super(mergeManifests(parent, manifest), forward)

      const prefix = (db.prefix || '') + separator + name + separator
      const upperBound = prefix.slice(0, -1) + String.fromCharCode(reserved)

      this[kParent] = parent
      this[kPrefix] = new MultiFormat(prefix)
      this[kUpperBound] = new MultiFormat(upperBound)
      this[kUnfix] = new Unfixer()

      this.nextTick = parent.nextTick
    }

    prefixKey (key, keyFormat) {
      if (keyFormat === 'utf8') {
        return this[kPrefix].utf8 + key
      } else if (key.byteLength === 0) {
        // Fast path for empty key (no copy)
        return this[kPrefix][keyFormat]
      } else if (keyFormat === 'view') {
        const view = this[kPrefix].view
        const result = new Uint8Array(view.byteLength + key.byteLength)

        result.set(view, 0)
        result.set(key, view.byteLength)

        return result
      } else {
        const buffer = this[kPrefix].buffer
        return Buffer.concat([buffer, key], buffer.byteLength + key.byteLength)
      }
    }

    // Not exposed for now.
    [kPrefixRange] (range, keyFormat) {
      if (range.gte !== undefined) {
        range.gte = this.prefixKey(range.gte, keyFormat)
      } else if (range.gt !== undefined) {
        range.gt = this.prefixKey(range.gt, keyFormat)
      } else {
        range.gte = this[kPrefix][keyFormat]
      }

      if (range.lte !== undefined) {
        range.lte = this.prefixKey(range.lte, keyFormat)
      } else if (range.lt !== undefined) {
        range.lt = this.prefixKey(range.lt, keyFormat)
      } else {
        range.lte = this[kUpperBound][keyFormat]
      }
    }

    get prefix () {
      return this[kPrefix].utf8
    }

    get db () {
      return this[kParent]
    }

    _open (options, callback) {
      // The parent db must open itself or be (re)opened by the user because
      // a sublevel should not initiate state changes on the rest of the db.
      this[kParent].open({ passive: true }, callback)
    }

    _put (key, value, options, callback) {
      this[kParent].put(key, value, options, callback)
    }

    _get (key, options, callback) {
      this[kParent].get(key, options, callback)
    }

    _getMany (keys, options, callback) {
      this[kParent].getMany(keys, options, callback)
    }

    _del (key, options, callback) {
      this[kParent].del(key, options, callback)
    }

    _batch (operations, options, callback) {
      this[kParent].batch(operations, options, callback)
    }

    _clear (options, callback) {
      // TODO (refactor): move to AbstractLevel
      this[kPrefixRange](options, options.keyEncoding)
      this[kParent].clear(options, callback)
    }

    _iterator (options) {
      // TODO (refactor): move to AbstractLevel
      this[kPrefixRange](options, options.keyEncoding)
      const iterator = this[kParent].iterator(options)
      const unfix = this[kUnfix].get(this[kPrefix].utf8.length, options.keyEncoding)
      return new AbstractSublevelIterator(this, options, iterator, unfix)
    }

    _keys (options) {
      this[kPrefixRange](options, options.keyEncoding)
      const iterator = this[kParent].keys(options)
      const unfix = this[kUnfix].get(this[kPrefix].utf8.length, options.keyEncoding)
      return new AbstractSublevelKeyIterator(this, options, iterator, unfix)
    }

    _values (options) {
      this[kPrefixRange](options, options.keyEncoding)
      const iterator = this[kParent].values(options)
      return new AbstractSublevelValueIterator(this, options, iterator)
    }
  }

  return { AbstractSublevel }
}

const mergeManifests = function (parent, manifest) {
  return {
    // Inherit manifest of parent db
    ...parent.supports,

    // Disable unsupported features
    createIfMissing: false,
    errorIfExists: false,

    // Unset additional events because we're not forwarding them
    events: {},

    // Unset additional methods (like approximateSize) which we can't support here unless
    // the AbstractSublevel class is overridden by an implementation of `abstract-level`.
    additionalMethods: {},

    // Inherit manifest of custom AbstractSublevel subclass. Such a class is not
    // allowed to override encodings.
    ...manifest,

    encodings: {
      utf8: supportsEncoding(parent, 'utf8'),
      buffer: supportsEncoding(parent, 'buffer'),
      view: supportsEncoding(parent, 'view')
    }
  }
}

const supportsEncoding = function (parent, encoding) {
  // Prefer a non-transcoded encoding for optimal performance
  return parent.supports.encodings[encoding]
    ? parent.keyEncoding(encoding).name === encoding
    : false
}

class MultiFormat {
  constructor (key) {
    this.utf8 = key
    this.view = textEncoder.encode(key)
    this.buffer = Buffer ? Buffer.from(this.view.buffer, 0, this.view.byteLength) : {}
  }
}

class Unfixer {
  constructor () {
    this.cache = new Map()
  }

  get (prefixLength, keyFormat) {
    let unfix = this.cache.get(keyFormat)

    if (unfix === undefined) {
      if (keyFormat === 'view') {
        unfix = function (prefixLength, key) {
          // Avoid Uint8Array#slice() because it copies
          return key.subarray(prefixLength)
        }.bind(null, prefixLength)
      } else {
        unfix = function (prefixLength, key) {
          // Avoid Buffer#subarray() because it's slow
          return key.slice(prefixLength)
        }.bind(null, prefixLength)
      }

      this.cache.set(keyFormat, unfix)
    }

    return unfix
  }
}

const trim = function (str, char) {
  let start = 0
  let end = str.length

  while (start < end && str[start] === char) start++
  while (end > start && str[end - 1] === char) end--

  return str.slice(start, end)
}


/***/ }),

/***/ "../../node_modules/abstract-level/lib/common.js":
/***/ ((__unused_webpack_module, exports) => {



exports.getCallback = function (options, callback) {
  return typeof options === 'function' ? options : callback
}

exports.getOptions = function (options, def) {
  if (typeof options === 'object' && options !== null) {
    return options
  }

  if (def !== undefined) {
    return def
  }

  return {}
}


/***/ }),

/***/ "../../node_modules/abstract-level/lib/default-chained-batch.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { AbstractChainedBatch } = __webpack_require__("../../node_modules/abstract-level/abstract-chained-batch.js")
const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const kEncoded = Symbol('encoded')

// Functional default for chained batch, with support of deferred open
class DefaultChainedBatch extends AbstractChainedBatch {
  constructor (db) {
    super(db)
    this[kEncoded] = []
  }

  _put (key, value, options) {
    this[kEncoded].push({ ...options, type: 'put', key, value })
  }

  _del (key, options) {
    this[kEncoded].push({ ...options, type: 'del', key })
  }

  _clear () {
    this[kEncoded] = []
  }

  // Assumes this[kEncoded] cannot change after write()
  _write (options, callback) {
    if (this.db.status === 'opening') {
      this.db.defer(() => this._write(options, callback))
    } else if (this.db.status === 'open') {
      if (this[kEncoded].length === 0) this.nextTick(callback)
      else this.db._batch(this[kEncoded], options, callback)
    } else {
      this.nextTick(callback, new ModuleError('Batch is not open: cannot call write() after write() or close()', {
        code: 'LEVEL_BATCH_NOT_OPEN'
      }))
    }
  }
}

exports.DefaultChainedBatch = DefaultChainedBatch


/***/ }),

/***/ "../../node_modules/abstract-level/lib/default-kv-iterator.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { AbstractKeyIterator, AbstractValueIterator } = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js")

const kIterator = Symbol('iterator')
const kCallback = Symbol('callback')
const kHandleOne = Symbol('handleOne')
const kHandleMany = Symbol('handleMany')

class DefaultKeyIterator extends AbstractKeyIterator {
  constructor (db, options) {
    super(db, options)

    this[kIterator] = db.iterator({ ...options, keys: true, values: false })
    this[kHandleOne] = this[kHandleOne].bind(this)
    this[kHandleMany] = this[kHandleMany].bind(this)
  }
}

class DefaultValueIterator extends AbstractValueIterator {
  constructor (db, options) {
    super(db, options)

    this[kIterator] = db.iterator({ ...options, keys: false, values: true })
    this[kHandleOne] = this[kHandleOne].bind(this)
    this[kHandleMany] = this[kHandleMany].bind(this)
  }
}

for (const Iterator of [DefaultKeyIterator, DefaultValueIterator]) {
  const keys = Iterator === DefaultKeyIterator
  const mapEntry = keys ? (entry) => entry[0] : (entry) => entry[1]

  Iterator.prototype._next = function (callback) {
    this[kCallback] = callback
    this[kIterator].next(this[kHandleOne])
  }

  Iterator.prototype[kHandleOne] = function (err, key, value) {
    const callback = this[kCallback]
    if (err) callback(err)
    else callback(null, keys ? key : value)
  }

  Iterator.prototype._nextv = function (size, options, callback) {
    this[kCallback] = callback
    this[kIterator].nextv(size, options, this[kHandleMany])
  }

  Iterator.prototype._all = function (options, callback) {
    this[kCallback] = callback
    this[kIterator].all(options, this[kHandleMany])
  }

  Iterator.prototype[kHandleMany] = function (err, entries) {
    const callback = this[kCallback]
    if (err) callback(err)
    else callback(null, entries.map(mapEntry))
  }

  Iterator.prototype._seek = function (target, options) {
    this[kIterator].seek(target, options)
  }

  Iterator.prototype._close = function (callback) {
    this[kIterator].close(callback)
  }
}

// Internal utilities, should be typed as AbstractKeyIterator and AbstractValueIterator
exports.DefaultKeyIterator = DefaultKeyIterator
exports.DefaultValueIterator = DefaultValueIterator


/***/ }),

/***/ "../../node_modules/abstract-level/lib/deferred-iterator.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { AbstractIterator, AbstractKeyIterator, AbstractValueIterator } = __webpack_require__("../../node_modules/abstract-level/abstract-iterator.js")
const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")

const kNut = Symbol('nut')
const kUndefer = Symbol('undefer')
const kFactory = Symbol('factory')

class DeferredIterator extends AbstractIterator {
  constructor (db, options) {
    super(db, options)

    this[kNut] = null
    this[kFactory] = () => db.iterator(options)

    this.db.defer(() => this[kUndefer]())
  }
}

class DeferredKeyIterator extends AbstractKeyIterator {
  constructor (db, options) {
    super(db, options)

    this[kNut] = null
    this[kFactory] = () => db.keys(options)

    this.db.defer(() => this[kUndefer]())
  }
}

class DeferredValueIterator extends AbstractValueIterator {
  constructor (db, options) {
    super(db, options)

    this[kNut] = null
    this[kFactory] = () => db.values(options)

    this.db.defer(() => this[kUndefer]())
  }
}

for (const Iterator of [DeferredIterator, DeferredKeyIterator, DeferredValueIterator]) {
  Iterator.prototype[kUndefer] = function () {
    if (this.db.status === 'open') {
      this[kNut] = this[kFactory]()
    }
  }

  Iterator.prototype._next = function (callback) {
    if (this[kNut] !== null) {
      this[kNut].next(callback)
    } else if (this.db.status === 'opening') {
      this.db.defer(() => this._next(callback))
    } else {
      this.nextTick(callback, new ModuleError('Iterator is not open: cannot call next() after close()', {
        code: 'LEVEL_ITERATOR_NOT_OPEN'
      }))
    }
  }

  Iterator.prototype._nextv = function (size, options, callback) {
    if (this[kNut] !== null) {
      this[kNut].nextv(size, options, callback)
    } else if (this.db.status === 'opening') {
      this.db.defer(() => this._nextv(size, options, callback))
    } else {
      this.nextTick(callback, new ModuleError('Iterator is not open: cannot call nextv() after close()', {
        code: 'LEVEL_ITERATOR_NOT_OPEN'
      }))
    }
  }

  Iterator.prototype._all = function (options, callback) {
    if (this[kNut] !== null) {
      this[kNut].all(callback)
    } else if (this.db.status === 'opening') {
      this.db.defer(() => this._all(options, callback))
    } else {
      this.nextTick(callback, new ModuleError('Iterator is not open: cannot call all() after close()', {
        code: 'LEVEL_ITERATOR_NOT_OPEN'
      }))
    }
  }

  Iterator.prototype._seek = function (target, options) {
    if (this[kNut] !== null) {
      // TODO: explain why we need _seek() rather than seek() here
      this[kNut]._seek(target, options)
    } else if (this.db.status === 'opening') {
      this.db.defer(() => this._seek(target, options))
    }
  }

  Iterator.prototype._close = function (callback) {
    if (this[kNut] !== null) {
      this[kNut].close(callback)
    } else if (this.db.status === 'opening') {
      this.db.defer(() => this._close(callback))
    } else {
      this.nextTick(callback)
    }
  }
}

exports.DeferredIterator = DeferredIterator
exports.DeferredKeyIterator = DeferredKeyIterator
exports.DeferredValueIterator = DeferredValueIterator


/***/ }),

/***/ "../../node_modules/abstract-level/lib/next-tick-browser.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const queueMicrotask = __webpack_require__("../../node_modules/queue-microtask/index.js")

module.exports = function (fn, ...args) {
  if (args.length === 0) {
    queueMicrotask(fn)
  } else {
    queueMicrotask(() => fn(...args))
  }
}


/***/ }),

/***/ "../../node_modules/abstract-level/lib/range-options.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const hasOwnProperty = Object.prototype.hasOwnProperty
const rangeOptions = new Set(['lt', 'lte', 'gt', 'gte'])

module.exports = function (options, keyEncoding) {
  const result = {}

  for (const k in options) {
    if (!hasOwnProperty.call(options, k)) continue
    if (k === 'keyEncoding' || k === 'valueEncoding') continue

    if (k === 'start' || k === 'end') {
      throw new ModuleError(`The legacy range option '${k}' has been removed`, {
        code: 'LEVEL_LEGACY'
      })
    } else if (k === 'encoding') {
      // To help migrating to abstract-level
      throw new ModuleError("The levelup-style 'encoding' alias has been removed, use 'valueEncoding' instead", {
        code: 'LEVEL_LEGACY'
      })
    }

    if (rangeOptions.has(k)) {
      // Note that we don't reject nullish and empty options here. While
      // those types are invalid as keys, they are valid as range options.
      result[k] = keyEncoding.encode(options[k])
    } else {
      result[k] = options[k]
    }
  }

  result.reverse = !!result.reverse
  result.limit = Number.isInteger(result.limit) && result.limit >= 0 ? result.limit : -1

  return result
}


/***/ }),

/***/ "../../node_modules/abstract-level/node_modules/level-supports/index.js":
/***/ ((__unused_webpack_module, exports) => {



exports.supports = function supports (...manifests) {
  const manifest = manifests.reduce((acc, m) => Object.assign(acc, m), {})

  return Object.assign(manifest, {
    snapshots: manifest.snapshots || false,
    permanence: manifest.permanence || false,
    seek: manifest.seek || false,
    clear: manifest.clear || false,
    getMany: manifest.getMany || false,
    keyIterator: manifest.keyIterator || false,
    valueIterator: manifest.valueIterator || false,
    iteratorNextv: manifest.iteratorNextv || false,
    iteratorAll: manifest.iteratorAll || false,
    status: manifest.status || false,
    createIfMissing: manifest.createIfMissing || false,
    errorIfExists: manifest.errorIfExists || false,
    deferredOpen: manifest.deferredOpen || false,
    promises: manifest.promises || false,
    streams: manifest.streams || false,
    encodings: Object.assign({}, manifest.encodings),
    events: Object.assign({}, manifest.events),
    additionalMethods: Object.assign({}, manifest.additionalMethods)
  })
}


/***/ }),

/***/ "../../node_modules/assertion-error/index.js":
/***/ ((module) => {

/*!
 * assertion-error
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */

/*!
 * Return a function that will copy properties from
 * one object to another excluding any originally
 * listed. Returned function will create a new `{}`.
 *
 * @param {String} excluded properties ...
 * @return {Function}
 */

function exclude () {
  var excludes = [].slice.call(arguments);

  function excludeProps (res, obj) {
    Object.keys(obj).forEach(function (key) {
      if (!~excludes.indexOf(key)) res[key] = obj[key];
    });
  }

  return function extendExclude () {
    var args = [].slice.call(arguments)
      , i = 0
      , res = {};

    for (; i < args.length; i++) {
      excludeProps(res, args[i]);
    }

    return res;
  };
};

/*!
 * Primary Exports
 */

module.exports = AssertionError;

/**
 * ### AssertionError
 *
 * An extension of the JavaScript `Error` constructor for
 * assertion and validation scenarios.
 *
 * @param {String} message
 * @param {Object} properties to include (optional)
 * @param {callee} start stack function (optional)
 */

function AssertionError (message, _props, ssf) {
  var extend = exclude('name', 'message', 'stack', 'constructor', 'toJSON')
    , props = extend(_props || {});

  // default values
  this.message = message || 'Unspecified AssertionError';
  this.showDiff = false;

  // copy from properties
  for (var key in props) {
    this[key] = props[key];
  }

  // capture stack trace
  ssf = ssf || AssertionError;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, ssf);
  } else {
    try {
      throw new Error();
    } catch(e) {
      this.stack = e.stack;
    }
  }
}

/*!
 * Inherit from Error.prototype
 */

AssertionError.prototype = Object.create(Error.prototype);

/*!
 * Statically set name
 */

AssertionError.prototype.name = 'AssertionError';

/*!
 * Ensure correct constructor
 */

AssertionError.prototype.constructor = AssertionError;

/**
 * Allow errors to be converted to JSON for static transfer.
 *
 * @param {Boolean} include stack (default: `true`)
 * @return {Object} object that can be `JSON.stringify`
 */

AssertionError.prototype.toJSON = function (stack) {
  var extend = exclude('constructor', 'toJSON', 'stack')
    , props = extend({ name: this.name }, this);

  // include stack if exists and not turned off
  if (false !== stack && this.stack) {
    props.stack = this.stack;
  }

  return props;
};


/***/ }),

/***/ "../../node_modules/base64-js/index.js":
/***/ ((__unused_webpack_module, exports) => {



exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}


/***/ }),

/***/ "../../node_modules/browser-level/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/* global indexedDB */



const { AbstractLevel } = __webpack_require__("../../node_modules/abstract-level/index.js")
const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const parallel = __webpack_require__("../../node_modules/run-parallel-limit/index.js")
const { fromCallback } = __webpack_require__("../../node_modules/catering/index.js")
const { Iterator } = __webpack_require__("../../node_modules/browser-level/iterator.js")
const deserialize = __webpack_require__("../../node_modules/browser-level/util/deserialize.js")
const clear = __webpack_require__("../../node_modules/browser-level/util/clear.js")
const createKeyRange = __webpack_require__("../../node_modules/browser-level/util/key-range.js")

// Keep as-is for compatibility with existing level-js databases
const DEFAULT_PREFIX = 'level-js-'

const kIDB = Symbol('idb')
const kNamePrefix = Symbol('namePrefix')
const kLocation = Symbol('location')
const kVersion = Symbol('version')
const kStore = Symbol('store')
const kOnComplete = Symbol('onComplete')
const kPromise = Symbol('promise')

class BrowserLevel extends AbstractLevel {
  constructor (location, options, _) {
    // To help migrating to abstract-level
    if (typeof options === 'function' || typeof _ === 'function') {
      throw new ModuleError('The levelup-style callback argument has been removed', {
        code: 'LEVEL_LEGACY'
      })
    }

    const { prefix, version, ...forward } = options || {}

    super({
      encodings: { view: true },
      snapshots: false,
      createIfMissing: false,
      errorIfExists: false,
      seek: true
    }, forward)

    if (typeof location !== 'string') {
      throw new Error('constructor requires a location string argument')
    }

    // TODO (next major): remove default prefix
    this[kLocation] = location
    this[kNamePrefix] = prefix == null ? DEFAULT_PREFIX : prefix
    this[kVersion] = parseInt(version || 1, 10)
    this[kIDB] = null
  }

  get location () {
    return this[kLocation]
  }

  get namePrefix () {
    return this[kNamePrefix]
  }

  get version () {
    return this[kVersion]
  }

  // Exposed for backwards compat and unit tests
  get db () {
    return this[kIDB]
  }

  get type () {
    return 'browser-level'
  }

  _open (options, callback) {
    const req = indexedDB.open(this[kNamePrefix] + this[kLocation], this[kVersion])

    req.onerror = function () {
      callback(req.error || new Error('unknown error'))
    }

    req.onsuccess = () => {
      this[kIDB] = req.result
      callback()
    }

    req.onupgradeneeded = (ev) => {
      const db = ev.target.result

      if (!db.objectStoreNames.contains(this[kLocation])) {
        db.createObjectStore(this[kLocation])
      }
    }
  }

  [kStore] (mode) {
    const transaction = this[kIDB].transaction([this[kLocation]], mode)
    return transaction.objectStore(this[kLocation])
  }

  [kOnComplete] (request, callback) {
    const transaction = request.transaction

    // Take advantage of the fact that a non-canceled request error aborts
    // the transaction. I.e. no need to listen for "request.onerror".
    transaction.onabort = function () {
      callback(transaction.error || new Error('aborted by user'))
    }

    transaction.oncomplete = function () {
      callback(null, request.result)
    }
  }

  _get (key, options, callback) {
    const store = this[kStore]('readonly')
    let req

    try {
      req = store.get(key)
    } catch (err) {
      return this.nextTick(callback, err)
    }

    this[kOnComplete](req, function (err, value) {
      if (err) return callback(err)

      if (value === undefined) {
        return callback(new ModuleError('Entry not found', {
          code: 'LEVEL_NOT_FOUND'
        }))
      }

      callback(null, deserialize(value))
    })
  }

  _getMany (keys, options, callback) {
    const store = this[kStore]('readonly')
    const tasks = keys.map((key) => (next) => {
      let request

      try {
        request = store.get(key)
      } catch (err) {
        return next(err)
      }

      request.onsuccess = () => {
        const value = request.result
        next(null, value === undefined ? value : deserialize(value))
      }

      request.onerror = (ev) => {
        ev.stopPropagation()
        next(request.error)
      }
    })

    parallel(tasks, 16, callback)
  }

  _del (key, options, callback) {
    const store = this[kStore]('readwrite')
    let req

    try {
      req = store.delete(key)
    } catch (err) {
      return this.nextTick(callback, err)
    }

    this[kOnComplete](req, callback)
  }

  _put (key, value, options, callback) {
    const store = this[kStore]('readwrite')
    let req

    try {
      // Will throw a DataError or DataCloneError if the environment
      // does not support serializing the key or value respectively.
      req = store.put(value, key)
    } catch (err) {
      return this.nextTick(callback, err)
    }

    this[kOnComplete](req, callback)
  }

  // TODO: implement key and value iterators
  _iterator (options) {
    return new Iterator(this, this[kLocation], options)
  }

  _batch (operations, options, callback) {
    const store = this[kStore]('readwrite')
    const transaction = store.transaction
    let index = 0
    let error

    transaction.onabort = function () {
      callback(error || transaction.error || new Error('aborted by user'))
    }

    transaction.oncomplete = function () {
      callback()
    }

    // Wait for a request to complete before making the next, saving CPU.
    function loop () {
      const op = operations[index++]
      const key = op.key

      let req

      try {
        req = op.type === 'del' ? store.delete(key) : store.put(op.value, key)
      } catch (err) {
        error = err
        transaction.abort()
        return
      }

      if (index < operations.length) {
        req.onsuccess = loop
      } else if (typeof transaction.commit === 'function') {
        // Commit now instead of waiting for auto-commit
        transaction.commit()
      }
    }

    loop()
  }

  _clear (options, callback) {
    let keyRange
    let req

    try {
      keyRange = createKeyRange(options)
    } catch (e) {
      // The lower key is greater than the upper key.
      // IndexedDB throws an error, but we'll just do nothing.
      return this.nextTick(callback)
    }

    if (options.limit >= 0) {
      // IDBObjectStore#delete(range) doesn't have such an option.
      // Fall back to cursor-based implementation.
      return clear(this, this[kLocation], keyRange, options, callback)
    }

    try {
      const store = this[kStore]('readwrite')
      req = keyRange ? store.delete(keyRange) : store.clear()
    } catch (err) {
      return this.nextTick(callback, err)
    }

    this[kOnComplete](req, callback)
  }

  _close (callback) {
    this[kIDB].close()
    this.nextTick(callback)
  }
}

BrowserLevel.destroy = function (location, prefix, callback) {
  if (typeof prefix === 'function') {
    callback = prefix
    prefix = DEFAULT_PREFIX
  }

  callback = fromCallback(callback, kPromise)
  const request = indexedDB.deleteDatabase(prefix + location)

  request.onsuccess = function () {
    callback()
  }

  request.onerror = function (err) {
    callback(err)
  }

  return callback[kPromise]
}

exports.v = BrowserLevel


/***/ }),

/***/ "../../node_modules/browser-level/iterator.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { AbstractIterator } = __webpack_require__("../../node_modules/abstract-level/index.js")
const createKeyRange = __webpack_require__("../../node_modules/browser-level/util/key-range.js")
const deserialize = __webpack_require__("../../node_modules/browser-level/util/deserialize.js")

const kCache = Symbol('cache')
const kFinished = Symbol('finished')
const kOptions = Symbol('options')
const kCurrentOptions = Symbol('currentOptions')
const kPosition = Symbol('position')
const kLocation = Symbol('location')
const kFirst = Symbol('first')
const emptyOptions = {}

class Iterator extends AbstractIterator {
  constructor (db, location, options) {
    super(db, options)

    this[kCache] = []
    this[kFinished] = this.limit === 0
    this[kOptions] = options
    this[kCurrentOptions] = { ...options }
    this[kPosition] = undefined
    this[kLocation] = location
    this[kFirst] = true
  }

  // Note: if called by _all() then size can be Infinity. This is an internal
  // detail; by design AbstractIterator.nextv() does not support Infinity.
  _nextv (size, options, callback) {
    this[kFirst] = false

    if (this[kFinished]) {
      return this.nextTick(callback, null, [])
    } else if (this[kCache].length > 0) {
      // TODO: mixing next and nextv is not covered by test suite
      size = Math.min(size, this[kCache].length)
      return this.nextTick(callback, null, this[kCache].splice(0, size))
    }

    // Adjust range by what we already visited
    if (this[kPosition] !== undefined) {
      if (this[kOptions].reverse) {
        this[kCurrentOptions].lt = this[kPosition]
        this[kCurrentOptions].lte = undefined
      } else {
        this[kCurrentOptions].gt = this[kPosition]
        this[kCurrentOptions].gte = undefined
      }
    }

    let keyRange

    try {
      keyRange = createKeyRange(this[kCurrentOptions])
    } catch (_) {
      // The lower key is greater than the upper key.
      // IndexedDB throws an error, but we'll just return 0 results.
      this[kFinished] = true
      return this.nextTick(callback, null, [])
    }

    const transaction = this.db.db.transaction([this[kLocation]], 'readonly')
    const store = transaction.objectStore(this[kLocation])
    const entries = []

    if (!this[kOptions].reverse) {
      let keys
      let values

      const complete = () => {
        // Wait for both requests to complete
        if (keys === undefined || values === undefined) return

        const length = Math.max(keys.length, values.length)

        if (length === 0 || size === Infinity) {
          this[kFinished] = true
        } else {
          this[kPosition] = keys[length - 1]
        }

        // Resize
        entries.length = length

        // Merge keys and values
        for (let i = 0; i < length; i++) {
          const key = keys[i]
          const value = values[i]

          entries[i] = [
            this[kOptions].keys && key !== undefined ? deserialize(key) : undefined,
            this[kOptions].values && value !== undefined ? deserialize(value) : undefined
          ]
        }

        maybeCommit(transaction)
      }

      // If keys were not requested and size is Infinity, we don't have to keep
      // track of position and can thus skip getting keys.
      if (this[kOptions].keys || size < Infinity) {
        store.getAllKeys(keyRange, size < Infinity ? size : undefined).onsuccess = (ev) => {
          keys = ev.target.result
          complete()
        }
      } else {
        keys = []
        this.nextTick(complete)
      }

      if (this[kOptions].values) {
        store.getAll(keyRange, size < Infinity ? size : undefined).onsuccess = (ev) => {
          values = ev.target.result
          complete()
        }
      } else {
        values = []
        this.nextTick(complete)
      }
    } else {
      // Can't use getAll() in reverse, so use a slower cursor that yields one item at a time
      // TODO: test if all target browsers support openKeyCursor
      const method = !this[kOptions].values && store.openKeyCursor ? 'openKeyCursor' : 'openCursor'

      store[method](keyRange, 'prev').onsuccess = (ev) => {
        const cursor = ev.target.result

        if (cursor) {
          const { key, value } = cursor
          this[kPosition] = key

          entries.push([
            this[kOptions].keys && key !== undefined ? deserialize(key) : undefined,
            this[kOptions].values && value !== undefined ? deserialize(value) : undefined
          ])

          if (entries.length < size) {
            cursor.continue()
          } else {
            maybeCommit(transaction)
          }
        } else {
          this[kFinished] = true
        }
      }
    }

    // If an error occurs (on the request), the transaction will abort.
    transaction.onabort = () => {
      callback(transaction.error || new Error('aborted by user'))
      callback = null
    }

    transaction.oncomplete = () => {
      callback(null, entries)
      callback = null
    }
  }

  _next (callback) {
    if (this[kCache].length > 0) {
      const [key, value] = this[kCache].shift()
      this.nextTick(callback, null, key, value)
    } else if (this[kFinished]) {
      this.nextTick(callback)
    } else {
      let size = Math.min(100, this.limit - this.count)

      if (this[kFirst]) {
        // It's common to only want one entry initially or after a seek()
        this[kFirst] = false
        size = 1
      }

      this._nextv(size, emptyOptions, (err, entries) => {
        if (err) return callback(err)
        this[kCache] = entries
        this._next(callback)
      })
    }
  }

  _all (options, callback) {
    this[kFirst] = false

    // TODO: mixing next and all is not covered by test suite
    const cache = this[kCache].splice(0, this[kCache].length)
    const size = this.limit - this.count - cache.length

    if (size <= 0) {
      return this.nextTick(callback, null, cache)
    }

    this._nextv(size, emptyOptions, (err, entries) => {
      if (err) return callback(err)
      if (cache.length > 0) entries = cache.concat(entries)
      callback(null, entries)
    })
  }

  _seek (target, options) {
    this[kFirst] = true
    this[kCache] = []
    this[kFinished] = false
    this[kPosition] = undefined

    // TODO: not covered by test suite
    this[kCurrentOptions] = { ...this[kOptions] }

    let keyRange

    try {
      keyRange = createKeyRange(this[kOptions])
    } catch (_) {
      this[kFinished] = true
      return
    }

    if (keyRange !== null && !keyRange.includes(target)) {
      this[kFinished] = true
    } else if (this[kOptions].reverse) {
      this[kCurrentOptions].lte = target
    } else {
      this[kCurrentOptions].gte = target
    }
  }
}

exports.Iterator = Iterator

function maybeCommit (transaction) {
  // Commit (meaning close) now instead of waiting for auto-commit
  if (typeof transaction.commit === 'function') {
    transaction.commit()
  }
}


/***/ }),

/***/ "../../node_modules/browser-level/util/clear.js":
/***/ ((module) => {



module.exports = function clear (db, location, keyRange, options, callback) {
  if (options.limit === 0) return db.nextTick(callback)

  const transaction = db.db.transaction([location], 'readwrite')
  const store = transaction.objectStore(location)
  let count = 0

  transaction.oncomplete = function () {
    callback()
  }

  transaction.onabort = function () {
    callback(transaction.error || new Error('aborted by user'))
  }

  // A key cursor is faster (skips reading values) but not supported by IE
  // TODO: we no longer support IE. Test others
  const method = store.openKeyCursor ? 'openKeyCursor' : 'openCursor'
  const direction = options.reverse ? 'prev' : 'next'

  store[method](keyRange, direction).onsuccess = function (ev) {
    const cursor = ev.target.result

    if (cursor) {
      // Wait for a request to complete before continuing, saving CPU.
      store.delete(cursor.key).onsuccess = function () {
        if (options.limit <= 0 || ++count < options.limit) {
          cursor.continue()
        }
      }
    }
  }
}


/***/ }),

/***/ "../../node_modules/browser-level/util/deserialize.js":
/***/ ((module) => {



const textEncoder = new TextEncoder()

module.exports = function (data) {
  if (data instanceof Uint8Array) {
    return data
  } else if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  } else {
    // Non-binary data stored with an old version (level-js < 5.0.0)
    return textEncoder.encode(data)
  }
}


/***/ }),

/***/ "../../node_modules/browser-level/util/key-range.js":
/***/ ((module) => {

/* global IDBKeyRange */



module.exports = function createKeyRange (options) {
  const lower = options.gte !== undefined ? options.gte : options.gt !== undefined ? options.gt : undefined
  const upper = options.lte !== undefined ? options.lte : options.lt !== undefined ? options.lt : undefined
  const lowerExclusive = options.gte === undefined
  const upperExclusive = options.lte === undefined

  if (lower !== undefined && upper !== undefined) {
    return IDBKeyRange.bound(lower, upper, lowerExclusive, upperExclusive)
  } else if (lower !== undefined) {
    return IDBKeyRange.lowerBound(lower, lowerExclusive)
  } else if (upper !== undefined) {
    return IDBKeyRange.upperBound(upper, upperExclusive)
  } else {
    return null
  }
}


/***/ }),

/***/ "../../node_modules/buffer/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */



const base64 = __webpack_require__("../../node_modules/base64-js/index.js")
const ieee754 = __webpack_require__("../../node_modules/ieee754/index.js")
const customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

const K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    const arr = new Uint8Array(1)
    const proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  const buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof SharedArrayBuffer !== 'undefined' &&
      (isInstance(value, SharedArrayBuffer) ||
      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  const valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  const b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpreted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  const length = byteLength(string, encoding) | 0
  let buf = createBuffer(length)

  const actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0
  const buf = createBuffer(length)
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayView (arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    const copy = new Uint8Array(arrayView)
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  }
  return fromArrayLike(arrayView)
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  let buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    const len = checked(obj.length) | 0
    const buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  let x = a.length
  let y = b.length

  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  let i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  const buffer = Buffer.allocUnsafe(length)
  let pos = 0
  for (i = 0; i < list.length; ++i) {
    let buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      if (pos + buf.length > buffer.length) {
        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)
        buf.copy(buffer, pos)
      } else {
        Uint8Array.prototype.set.call(
          buffer,
          buf,
          pos
        )
      }
    } else if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    } else {
      buf.copy(buffer, pos)
    }
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  const len = string.length
  const mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  let loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  const i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  const len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  const len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  const len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  const length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  let str = ''
  const max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  let x = thisEnd - thisStart
  let y = end - start
  const len = Math.min(x, y)

  const thisCopy = this.slice(thisStart, thisEnd)
  const targetCopy = target.slice(start, end)

  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  let indexSize = 1
  let arrLength = arr.length
  let valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  let i
  if (dir) {
    let foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      let found = true
      for (let j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  const remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  const strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  let i
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  const remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
      case 'latin1':
      case 'binary':
        return asciiWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  const res = []

  let i = start
  while (i < end) {
    const firstByte = buf[i]
    let codePoint = null
    let bytesPerSequence = (firstByte > 0xEF)
      ? 4
      : (firstByte > 0xDF)
          ? 3
          : (firstByte > 0xBF)
              ? 2
              : 1

    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  const len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  let res = ''
  let i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  const len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  let out = ''
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  const bytes = buf.slice(start, end)
  let res = ''
  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  const len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  const newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUintLE =
Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUintBE =
Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  let val = this[offset + --byteLength]
  let mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUint8 =
Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUint16LE =
Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUint16BE =
Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUint32LE =
Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUint32BE =
Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const lo = first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24

  const hi = this[++offset] +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    last * 2 ** 24

  return BigInt(lo) + (BigInt(hi) << BigInt(32))
})

Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const hi = first * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  const lo = this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last

  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
})

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let i = byteLength
  let mul = 1
  let val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = this[offset + 4] +
    this[offset + 5] * 2 ** 8 +
    this[offset + 6] * 2 ** 16 +
    (last << 24) // Overflow

  return (BigInt(val) << BigInt(32)) +
    BigInt(first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24)
})

Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = (first << 24) + // Overflow
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  return (BigInt(val) << BigInt(32)) +
    BigInt(this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last)
})

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUintLE =
Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let mul = 1
  let i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUintBE =
Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let i = byteLength - 1
  let mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUint8 =
Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUint16LE =
Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUint16BE =
Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUint32LE =
Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUint32BE =
Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function wrtBigUInt64LE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  return offset
}

function wrtBigUInt64BE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset + 7] = lo
  lo = lo >> 8
  buf[offset + 6] = lo
  lo = lo >> 8
  buf[offset + 5] = lo
  lo = lo >> 8
  buf[offset + 4] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset + 3] = hi
  hi = hi >> 8
  buf[offset + 2] = hi
  hi = hi >> 8
  buf[offset + 1] = hi
  hi = hi >> 8
  buf[offset] = hi
  return offset + 8
}

Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = 0
  let mul = 1
  let sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = byteLength - 1
  let mul = 1
  let sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  const len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      const code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  let i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    const bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    const len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// CUSTOM ERRORS
// =============

// Simplified versions from Node, changed for Buffer-only usage
const errors = {}
function E (sym, getMessage, Base) {
  errors[sym] = class NodeError extends Base {
    constructor () {
      super()

      Object.defineProperty(this, 'message', {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      })

      // Add the error code to the name to include it in the stack trace.
      this.name = `${this.name} [${sym}]`
      // Access the stack to generate the error message including the error code
      // from the name.
      this.stack // eslint-disable-line no-unused-expressions
      // Reset the name to the actual name.
      delete this.name
    }

    get code () {
      return sym
    }

    set code (value) {
      Object.defineProperty(this, 'code', {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      })
    }

    toString () {
      return `${this.name} [${sym}]: ${this.message}`
    }
  }
}

E('ERR_BUFFER_OUT_OF_BOUNDS',
  function (name) {
    if (name) {
      return `${name} is outside of buffer bounds`
    }

    return 'Attempt to access memory outside buffer bounds'
  }, RangeError)
E('ERR_INVALID_ARG_TYPE',
  function (name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
  }, TypeError)
E('ERR_OUT_OF_RANGE',
  function (str, range, input) {
    let msg = `The value of "${str}" is out of range.`
    let received = input
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input))
    } else if (typeof input === 'bigint') {
      received = String(input)
      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
        received = addNumericalSeparator(received)
      }
      received += 'n'
    }
    msg += ` It must be ${range}. Received ${received}`
    return msg
  }, RangeError)

function addNumericalSeparator (val) {
  let res = ''
  let i = val.length
  const start = val[0] === '-' ? 1 : 0
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`
  }
  return `${val.slice(0, i)}${res}`
}

// CHECK FUNCTIONS
// ===============

function checkBounds (buf, offset, byteLength) {
  validateNumber(offset, 'offset')
  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
    boundsError(offset, buf.length - (byteLength + 1))
  }
}

function checkIntBI (value, min, max, buf, offset, byteLength) {
  if (value > max || value < min) {
    const n = typeof min === 'bigint' ? 'n' : ''
    let range
    if (byteLength > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`
      } else {
        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
                `${(byteLength + 1) * 8 - 1}${n}`
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`
    }
    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
  }
  checkBounds(buf, offset, byteLength)
}

function validateNumber (value, name) {
  if (typeof value !== 'number') {
    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
  }
}

function boundsError (value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type)
    throw new errors.ERR_OUT_OF_RANGE(type || 'offset', 'an integer', value)
  }

  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
  }

  throw new errors.ERR_OUT_OF_RANGE(type || 'offset',
                                    `>= ${type ? 1 : 0} and <= ${length}`,
                                    value)
}

// HELPER FUNCTIONS
// ================

const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  let codePoint
  const length = string.length
  let leadSurrogate = null
  const bytes = []

  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  let c, hi, lo
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  let i
  for (i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef'
  const table = new Array(256)
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

// Return not function with Error if BigInt not supported
function defineBigIntMethod (fn) {
  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
}

function BufferBigIntNotDefined () {
  throw new Error('BigInt not supported')
}


/***/ }),

/***/ "../../node_modules/catering/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var nextTick = __webpack_require__("../../node_modules/catering/next-tick-browser.js")

exports.fromCallback = function (callback, symbol) {
  if (callback === undefined) {
    var promise = new Promise(function (resolve, reject) {
      callback = function (err, res) {
        if (err) reject(err)
        else resolve(res)
      }
    })

    callback[symbol !== undefined ? symbol : 'promise'] = promise
  } else if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function')
  }

  return callback
}

exports.fromPromise = function (promise, callback) {
  if (callback === undefined) return promise

  promise
    .then(function (res) { nextTick(() => callback(null, res)) })
    .catch(function (err) { nextTick(() => callback(err)) })
}


/***/ }),

/***/ "../../node_modules/catering/next-tick-browser.js":
/***/ ((module) => {

module.exports = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn)


/***/ }),

/***/ "../../node_modules/chai/index.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__("../../node_modules/chai/lib/chai.js");


/***/ }),

/***/ "../../node_modules/chai/lib/chai.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var used = [];

/*!
 * Chai version
 */

exports.version = '4.3.3';

/*!
 * Assertion Error
 */

exports.AssertionError = __webpack_require__("../../node_modules/assertion-error/index.js");

/*!
 * Utils for plugins (not exported)
 */

var util = __webpack_require__("../../node_modules/chai/lib/chai/utils/index.js");

/**
 * # .use(function)
 *
 * Provides a way to extend the internals of Chai.
 *
 * @param {Function}
 * @returns {this} for chaining
 * @api public
 */

exports.use = function (fn) {
  if (!~used.indexOf(fn)) {
    fn(exports, util);
    used.push(fn);
  }

  return exports;
};

/*!
 * Utility Functions
 */

exports.util = util;

/*!
 * Configuration
 */

var config = __webpack_require__("../../node_modules/chai/lib/chai/config.js");
exports.config = config;

/*!
 * Primary `Assertion` prototype
 */

var assertion = __webpack_require__("../../node_modules/chai/lib/chai/assertion.js");
exports.use(assertion);

/*!
 * Core Assertions
 */

var core = __webpack_require__("../../node_modules/chai/lib/chai/core/assertions.js");
exports.use(core);

/*!
 * Expect interface
 */

var expect = __webpack_require__("../../node_modules/chai/lib/chai/interface/expect.js");
exports.use(expect);

/*!
 * Should interface
 */

var should = __webpack_require__("../../node_modules/chai/lib/chai/interface/should.js");
exports.use(should);

/*!
 * Assert interface
 */

var assert = __webpack_require__("../../node_modules/chai/lib/chai/interface/assert.js");
exports.use(assert);


/***/ }),

/***/ "../../node_modules/chai/lib/chai/assertion.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var config = __webpack_require__("../../node_modules/chai/lib/chai/config.js");

module.exports = function (_chai, util) {
  /*!
   * Module dependencies.
   */

  var AssertionError = _chai.AssertionError
    , flag = util.flag;

  /*!
   * Module export.
   */

  _chai.Assertion = Assertion;

  /*!
   * Assertion Constructor
   *
   * Creates object for chaining.
   *
   * `Assertion` objects contain metadata in the form of flags. Three flags can
   * be assigned during instantiation by passing arguments to this constructor:
   *
   * - `object`: This flag contains the target of the assertion. For example, in
   *   the assertion `expect(numKittens).to.equal(7);`, the `object` flag will
   *   contain `numKittens` so that the `equal` assertion can reference it when
   *   needed.
   *
   * - `message`: This flag contains an optional custom error message to be
   *   prepended to the error message that's generated by the assertion when it
   *   fails.
   *
   * - `ssfi`: This flag stands for "start stack function indicator". It
   *   contains a function reference that serves as the starting point for
   *   removing frames from the stack trace of the error that's created by the
   *   assertion when it fails. The goal is to provide a cleaner stack trace to
   *   end users by removing Chai's internal functions. Note that it only works
   *   in environments that support `Error.captureStackTrace`, and only when
   *   `Chai.config.includeStack` hasn't been set to `false`.
   *
   * - `lockSsfi`: This flag controls whether or not the given `ssfi` flag
   *   should retain its current value, even as assertions are chained off of
   *   this object. This is usually set to `true` when creating a new assertion
   *   from within another assertion. It's also temporarily set to `true` before
   *   an overwritten assertion gets called by the overwriting assertion.
   *
   * @param {Mixed} obj target of the assertion
   * @param {String} msg (optional) custom error message
   * @param {Function} ssfi (optional) starting point for removing stack frames
   * @param {Boolean} lockSsfi (optional) whether or not the ssfi flag is locked
   * @api private
   */

  function Assertion (obj, msg, ssfi, lockSsfi) {
    flag(this, 'ssfi', ssfi || Assertion);
    flag(this, 'lockSsfi', lockSsfi);
    flag(this, 'object', obj);
    flag(this, 'message', msg);

    return util.proxify(this);
  }

  Object.defineProperty(Assertion, 'includeStack', {
    get: function() {
      console.warn('Assertion.includeStack is deprecated, use chai.config.includeStack instead.');
      return config.includeStack;
    },
    set: function(value) {
      console.warn('Assertion.includeStack is deprecated, use chai.config.includeStack instead.');
      config.includeStack = value;
    }
  });

  Object.defineProperty(Assertion, 'showDiff', {
    get: function() {
      console.warn('Assertion.showDiff is deprecated, use chai.config.showDiff instead.');
      return config.showDiff;
    },
    set: function(value) {
      console.warn('Assertion.showDiff is deprecated, use chai.config.showDiff instead.');
      config.showDiff = value;
    }
  });

  Assertion.addProperty = function (name, fn) {
    util.addProperty(this.prototype, name, fn);
  };

  Assertion.addMethod = function (name, fn) {
    util.addMethod(this.prototype, name, fn);
  };

  Assertion.addChainableMethod = function (name, fn, chainingBehavior) {
    util.addChainableMethod(this.prototype, name, fn, chainingBehavior);
  };

  Assertion.overwriteProperty = function (name, fn) {
    util.overwriteProperty(this.prototype, name, fn);
  };

  Assertion.overwriteMethod = function (name, fn) {
    util.overwriteMethod(this.prototype, name, fn);
  };

  Assertion.overwriteChainableMethod = function (name, fn, chainingBehavior) {
    util.overwriteChainableMethod(this.prototype, name, fn, chainingBehavior);
  };

  /**
   * ### .assert(expression, message, negateMessage, expected, actual, showDiff)
   *
   * Executes an expression and check expectations. Throws AssertionError for reporting if test doesn't pass.
   *
   * @name assert
   * @param {Philosophical} expression to be tested
   * @param {String|Function} message or function that returns message to display if expression fails
   * @param {String|Function} negatedMessage or function that returns negatedMessage to display if negated expression fails
   * @param {Mixed} expected value (remember to check for negation)
   * @param {Mixed} actual (optional) will default to `this.obj`
   * @param {Boolean} showDiff (optional) when set to `true`, assert will display a diff in addition to the message if expression fails
   * @api private
   */

  Assertion.prototype.assert = function (expr, msg, negateMsg, expected, _actual, showDiff) {
    var ok = util.test(this, arguments);
    if (false !== showDiff) showDiff = true;
    if (undefined === expected && undefined === _actual) showDiff = false;
    if (true !== config.showDiff) showDiff = false;

    if (!ok) {
      msg = util.getMessage(this, arguments);
      var actual = util.getActual(this, arguments);
      var assertionErrorObjectProperties = {
          actual: actual
        , expected: expected
        , showDiff: showDiff
      };

      var operator = util.getOperator(this, arguments);
      if (operator) {
        assertionErrorObjectProperties.operator = operator;
      }

      throw new AssertionError(
        msg,
        assertionErrorObjectProperties,
        (config.includeStack) ? this.assert : flag(this, 'ssfi'));
    }
  };

  /*!
   * ### ._obj
   *
   * Quick reference to stored `actual` value for plugin developers.
   *
   * @api private
   */

  Object.defineProperty(Assertion.prototype, '_obj',
    { get: function () {
        return flag(this, 'object');
      }
    , set: function (val) {
        flag(this, 'object', val);
      }
  });
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/config.js":
/***/ ((module) => {

module.exports = {

  /**
   * ### config.includeStack
   *
   * User configurable property, influences whether stack trace
   * is included in Assertion error message. Default of false
   * suppresses stack trace in the error message.
   *
   *     chai.config.includeStack = true;  // enable stack on error
   *
   * @param {Boolean}
   * @api public
   */

  includeStack: false,

  /**
   * ### config.showDiff
   *
   * User configurable property, influences whether or not
   * the `showDiff` flag should be included in the thrown
   * AssertionErrors. `false` will always be `false`; `true`
   * will be true when the assertion has requested a diff
   * be shown.
   *
   * @param {Boolean}
   * @api public
   */

  showDiff: true,

  /**
   * ### config.truncateThreshold
   *
   * User configurable property, sets length threshold for actual and
   * expected values in assertion errors. If this threshold is exceeded, for
   * example for large data structures, the value is replaced with something
   * like `[ Array(3) ]` or `{ Object (prop1, prop2) }`.
   *
   * Set it to zero if you want to disable truncating altogether.
   *
   * This is especially userful when doing assertions on arrays: having this
   * set to a reasonable large value makes the failure messages readily
   * inspectable.
   *
   *     chai.config.truncateThreshold = 0;  // disable truncating
   *
   * @param {Number}
   * @api public
   */

  truncateThreshold: 40,

  /**
   * ### config.useProxy
   *
   * User configurable property, defines if chai will use a Proxy to throw
   * an error when a non-existent property is read, which protects users
   * from typos when using property-based assertions.
   *
   * Set it to false if you want to disable this feature.
   *
   *     chai.config.useProxy = false;  // disable use of Proxy
   *
   * This feature is automatically disabled regardless of this config value
   * in environments that don't support proxies.
   *
   * @param {Boolean}
   * @api public
   */

  useProxy: true,

  /**
   * ### config.proxyExcludedKeys
   *
   * User configurable property, defines which properties should be ignored
   * instead of throwing an error if they do not exist on the assertion.
   * This is only applied if the environment Chai is running in supports proxies and
   * if the `useProxy` configuration setting is enabled.
   * By default, `then` and `inspect` will not throw an error if they do not exist on the
   * assertion object because the `.inspect` property is read by `util.inspect` (for example, when
   * using `console.log` on the assertion object) and `.then` is necessary for promise type-checking.
   *
   *     // By default these keys will not throw an error if they do not exist on the assertion object
   *     chai.config.proxyExcludedKeys = ['then', 'inspect'];
   *
   * @param {Array}
   * @api public
   */

  proxyExcludedKeys: ['then', 'catch', 'inspect', 'toJSON']
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/core/assertions.js":
/***/ ((module) => {

/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, _) {
  var Assertion = chai.Assertion
    , AssertionError = chai.AssertionError
    , flag = _.flag;

  /**
   * ### Language Chains
   *
   * The following are provided as chainable getters to improve the readability
   * of your assertions.
   *
   * **Chains**
   *
   * - to
   * - be
   * - been
   * - is
   * - that
   * - which
   * - and
   * - has
   * - have
   * - with
   * - at
   * - of
   * - same
   * - but
   * - does
   * - still
   * - also
   *
   * @name language chains
   * @namespace BDD
   * @api public
   */

  [ 'to', 'be', 'been', 'is'
  , 'and', 'has', 'have', 'with'
  , 'that', 'which', 'at', 'of'
  , 'same', 'but', 'does', 'still', "also" ].forEach(function (chain) {
    Assertion.addProperty(chain);
  });

  /**
   * ### .not
   *
   * Negates all assertions that follow in the chain.
   *
   *     expect(function () {}).to.not.throw();
   *     expect({a: 1}).to.not.have.property('b');
   *     expect([1, 2]).to.be.an('array').that.does.not.include(3);
   *
   * Just because you can negate any assertion with `.not` doesn't mean you
   * should. With great power comes great responsibility. It's often best to
   * assert that the one expected output was produced, rather than asserting
   * that one of countless unexpected outputs wasn't produced. See individual
   * assertions for specific guidance.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.not.equal(1); // Not recommended
   *
   * @name not
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('not', function () {
    flag(this, 'negate', true);
  });

  /**
   * ### .deep
   *
   * Causes all `.equal`, `.include`, `.members`, `.keys`, and `.property`
   * assertions that follow in the chain to use deep equality instead of strict
   * (`===`) equality. See the `deep-eql` project page for info on the deep
   * equality algorithm: https://github.com/chaijs/deep-eql.
   *
   *     // Target object deeply (but not strictly) equals `{a: 1}`
   *     expect({a: 1}).to.deep.equal({a: 1});
   *     expect({a: 1}).to.not.equal({a: 1});
   *
   *     // Target array deeply (but not strictly) includes `{a: 1}`
   *     expect([{a: 1}]).to.deep.include({a: 1});
   *     expect([{a: 1}]).to.not.include({a: 1});
   *
   *     // Target object deeply (but not strictly) includes `x: {a: 1}`
   *     expect({x: {a: 1}}).to.deep.include({x: {a: 1}});
   *     expect({x: {a: 1}}).to.not.include({x: {a: 1}});
   *
   *     // Target array deeply (but not strictly) has member `{a: 1}`
   *     expect([{a: 1}]).to.have.deep.members([{a: 1}]);
   *     expect([{a: 1}]).to.not.have.members([{a: 1}]);
   *
   *     // Target set deeply (but not strictly) has key `{a: 1}`
   *     expect(new Set([{a: 1}])).to.have.deep.keys([{a: 1}]);
   *     expect(new Set([{a: 1}])).to.not.have.keys([{a: 1}]);
   *
   *     // Target object deeply (but not strictly) has property `x: {a: 1}`
   *     expect({x: {a: 1}}).to.have.deep.property('x', {a: 1});
   *     expect({x: {a: 1}}).to.not.have.property('x', {a: 1});
   *
   * @name deep
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('deep', function () {
    flag(this, 'deep', true);
  });

  /**
   * ### .nested
   *
   * Enables dot- and bracket-notation in all `.property` and `.include`
   * assertions that follow in the chain.
   *
   *     expect({a: {b: ['x', 'y']}}).to.have.nested.property('a.b[1]');
   *     expect({a: {b: ['x', 'y']}}).to.nested.include({'a.b[1]': 'y'});
   *
   * If `.` or `[]` are part of an actual property name, they can be escaped by
   * adding two backslashes before them.
   *
   *     expect({'.a': {'[b]': 'x'}}).to.have.nested.property('\\.a.\\[b\\]');
   *     expect({'.a': {'[b]': 'x'}}).to.nested.include({'\\.a.\\[b\\]': 'x'});
   *
   * `.nested` cannot be combined with `.own`.
   *
   * @name nested
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('nested', function () {
    flag(this, 'nested', true);
  });

  /**
   * ### .own
   *
   * Causes all `.property` and `.include` assertions that follow in the chain
   * to ignore inherited properties.
   *
   *     Object.prototype.b = 2;
   *
   *     expect({a: 1}).to.have.own.property('a');
   *     expect({a: 1}).to.have.property('b');
   *     expect({a: 1}).to.not.have.own.property('b');
   *
   *     expect({a: 1}).to.own.include({a: 1});
   *     expect({a: 1}).to.include({b: 2}).but.not.own.include({b: 2});
   *
   * `.own` cannot be combined with `.nested`.
   *
   * @name own
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('own', function () {
    flag(this, 'own', true);
  });

  /**
   * ### .ordered
   *
   * Causes all `.members` assertions that follow in the chain to require that
   * members be in the same order.
   *
   *     expect([1, 2]).to.have.ordered.members([1, 2])
   *       .but.not.have.ordered.members([2, 1]);
   *
   * When `.include` and `.ordered` are combined, the ordering begins at the
   * start of both arrays.
   *
   *     expect([1, 2, 3]).to.include.ordered.members([1, 2])
   *       .but.not.include.ordered.members([2, 3]);
   *
   * @name ordered
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('ordered', function () {
    flag(this, 'ordered', true);
  });

  /**
   * ### .any
   *
   * Causes all `.keys` assertions that follow in the chain to only require that
   * the target have at least one of the given keys. This is the opposite of
   * `.all`, which requires that the target have all of the given keys.
   *
   *     expect({a: 1, b: 2}).to.not.have.any.keys('c', 'd');
   *
   * See the `.keys` doc for guidance on when to use `.any` or `.all`.
   *
   * @name any
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('any', function () {
    flag(this, 'any', true);
    flag(this, 'all', false);
  });

  /**
   * ### .all
   *
   * Causes all `.keys` assertions that follow in the chain to require that the
   * target have all of the given keys. This is the opposite of `.any`, which
   * only requires that the target have at least one of the given keys.
   *
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b');
   *
   * Note that `.all` is used by default when neither `.all` nor `.any` are
   * added earlier in the chain. However, it's often best to add `.all` anyway
   * because it improves readability.
   *
   * See the `.keys` doc for guidance on when to use `.any` or `.all`.
   *
   * @name all
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('all', function () {
    flag(this, 'all', true);
    flag(this, 'any', false);
  });

  /**
   * ### .a(type[, msg])
   *
   * Asserts that the target's type is equal to the given string `type`. Types
   * are case insensitive. See the `type-detect` project page for info on the
   * type detection algorithm: https://github.com/chaijs/type-detect.
   *
   *     expect('foo').to.be.a('string');
   *     expect({a: 1}).to.be.an('object');
   *     expect(null).to.be.a('null');
   *     expect(undefined).to.be.an('undefined');
   *     expect(new Error).to.be.an('error');
   *     expect(Promise.resolve()).to.be.a('promise');
   *     expect(new Float32Array).to.be.a('float32array');
   *     expect(Symbol()).to.be.a('symbol');
   *
   * `.a` supports objects that have a custom type set via `Symbol.toStringTag`.
   *
   *     var myObj = {
   *       [Symbol.toStringTag]: 'myCustomType'
   *     };
   *
   *     expect(myObj).to.be.a('myCustomType').but.not.an('object');
   *
   * It's often best to use `.a` to check a target's type before making more
   * assertions on the same target. That way, you avoid unexpected behavior from
   * any assertion that does different things based on the target's type.
   *
   *     expect([1, 2, 3]).to.be.an('array').that.includes(2);
   *     expect([]).to.be.an('array').that.is.empty;
   *
   * Add `.not` earlier in the chain to negate `.a`. However, it's often best to
   * assert that the target is the expected type, rather than asserting that it
   * isn't one of many unexpected types.
   *
   *     expect('foo').to.be.a('string'); // Recommended
   *     expect('foo').to.not.be.an('array'); // Not recommended
   *
   * `.a` accepts an optional `msg` argument which is a custom error message to
   * show when the assertion fails. The message can also be given as the second
   * argument to `expect`.
   *
   *     expect(1).to.be.a('string', 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.a('string');
   *
   * `.a` can also be used as a language chain to improve the readability of
   * your assertions.
   *
   *     expect({b: 2}).to.have.a.property('b');
   *
   * The alias `.an` can be used interchangeably with `.a`.
   *
   * @name a
   * @alias an
   * @param {String} type
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function an (type, msg) {
    if (msg) flag(this, 'message', msg);
    type = type.toLowerCase();
    var obj = flag(this, 'object')
      , article = ~[ 'a', 'e', 'i', 'o', 'u' ].indexOf(type.charAt(0)) ? 'an ' : 'a ';

    this.assert(
        type === _.type(obj).toLowerCase()
      , 'expected #{this} to be ' + article + type
      , 'expected #{this} not to be ' + article + type
    );
  }

  Assertion.addChainableMethod('an', an);
  Assertion.addChainableMethod('a', an);

  /**
   * ### .include(val[, msg])
   *
   * When the target is a string, `.include` asserts that the given string `val`
   * is a substring of the target.
   *
   *     expect('foobar').to.include('foo');
   *
   * When the target is an array, `.include` asserts that the given `val` is a
   * member of the target.
   *
   *     expect([1, 2, 3]).to.include(2);
   *
   * When the target is an object, `.include` asserts that the given object
   * `val`'s properties are a subset of the target's properties.
   *
   *     expect({a: 1, b: 2, c: 3}).to.include({a: 1, b: 2});
   *
   * When the target is a Set or WeakSet, `.include` asserts that the given `val` is a
   * member of the target. SameValueZero equality algorithm is used.
   *
   *     expect(new Set([1, 2])).to.include(2);
   *
   * When the target is a Map, `.include` asserts that the given `val` is one of
   * the values of the target. SameValueZero equality algorithm is used.
   *
   *     expect(new Map([['a', 1], ['b', 2]])).to.include(2);
   *
   * Because `.include` does different things based on the target's type, it's
   * important to check the target's type before using `.include`. See the `.a`
   * doc for info on testing a target's type.
   *
   *     expect([1, 2, 3]).to.be.an('array').that.includes(2);
   *
   * By default, strict (`===`) equality is used to compare array members and
   * object properties. Add `.deep` earlier in the chain to use deep equality
   * instead (WeakSet targets are not supported). See the `deep-eql` project
   * page for info on the deep equality algorithm: https://github.com/chaijs/deep-eql.
   *
   *     // Target array deeply (but not strictly) includes `{a: 1}`
   *     expect([{a: 1}]).to.deep.include({a: 1});
   *     expect([{a: 1}]).to.not.include({a: 1});
   *
   *     // Target object deeply (but not strictly) includes `x: {a: 1}`
   *     expect({x: {a: 1}}).to.deep.include({x: {a: 1}});
   *     expect({x: {a: 1}}).to.not.include({x: {a: 1}});
   *
   * By default, all of the target's properties are searched when working with
   * objects. This includes properties that are inherited and/or non-enumerable.
   * Add `.own` earlier in the chain to exclude the target's inherited
   * properties from the search.
   *
   *     Object.prototype.b = 2;
   *
   *     expect({a: 1}).to.own.include({a: 1});
   *     expect({a: 1}).to.include({b: 2}).but.not.own.include({b: 2});
   *
   * Note that a target object is always only searched for `val`'s own
   * enumerable properties.
   *
   * `.deep` and `.own` can be combined.
   *
   *     expect({a: {b: 2}}).to.deep.own.include({a: {b: 2}});
   *
   * Add `.nested` earlier in the chain to enable dot- and bracket-notation when
   * referencing nested properties.
   *
   *     expect({a: {b: ['x', 'y']}}).to.nested.include({'a.b[1]': 'y'});
   *
   * If `.` or `[]` are part of an actual property name, they can be escaped by
   * adding two backslashes before them.
   *
   *     expect({'.a': {'[b]': 2}}).to.nested.include({'\\.a.\\[b\\]': 2});
   *
   * `.deep` and `.nested` can be combined.
   *
   *     expect({a: {b: [{c: 3}]}}).to.deep.nested.include({'a.b[0]': {c: 3}});
   *
   * `.own` and `.nested` cannot be combined.
   *
   * Add `.not` earlier in the chain to negate `.include`.
   *
   *     expect('foobar').to.not.include('taco');
   *     expect([1, 2, 3]).to.not.include(4);
   *
   * However, it's dangerous to negate `.include` when the target is an object.
   * The problem is that it creates uncertain expectations by asserting that the
   * target object doesn't have all of `val`'s key/value pairs but may or may
   * not have some of them. It's often best to identify the exact output that's
   * expected, and then write an assertion that only accepts that exact output.
   *
   * When the target object isn't even expected to have `val`'s keys, it's
   * often best to assert exactly that.
   *
   *     expect({c: 3}).to.not.have.any.keys('a', 'b'); // Recommended
   *     expect({c: 3}).to.not.include({a: 1, b: 2}); // Not recommended
   *
   * When the target object is expected to have `val`'s keys, it's often best to
   * assert that each of the properties has its expected value, rather than
   * asserting that each property doesn't have one of many unexpected values.
   *
   *     expect({a: 3, b: 4}).to.include({a: 3, b: 4}); // Recommended
   *     expect({a: 3, b: 4}).to.not.include({a: 1, b: 2}); // Not recommended
   *
   * `.include` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect([1, 2, 3]).to.include(4, 'nooo why fail??');
   *     expect([1, 2, 3], 'nooo why fail??').to.include(4);
   *
   * `.include` can also be used as a language chain, causing all `.members` and
   * `.keys` assertions that follow in the chain to require the target to be a
   * superset of the expected set, rather than an identical set. Note that
   * `.members` ignores duplicates in the subset when `.include` is added.
   *
   *     // Target object's keys are a superset of ['a', 'b'] but not identical
   *     expect({a: 1, b: 2, c: 3}).to.include.all.keys('a', 'b');
   *     expect({a: 1, b: 2, c: 3}).to.not.have.all.keys('a', 'b');
   *
   *     // Target array is a superset of [1, 2] but not identical
   *     expect([1, 2, 3]).to.include.members([1, 2]);
   *     expect([1, 2, 3]).to.not.have.members([1, 2]);
   *
   *     // Duplicates in the subset are ignored
   *     expect([1, 2, 3]).to.include.members([1, 2, 2, 2]);
   *
   * Note that adding `.any` earlier in the chain causes the `.keys` assertion
   * to ignore `.include`.
   *
   *     // Both assertions are identical
   *     expect({a: 1}).to.include.any.keys('a', 'b');
   *     expect({a: 1}).to.have.any.keys('a', 'b');
   *
   * The aliases `.includes`, `.contain`, and `.contains` can be used
   * interchangeably with `.include`.
   *
   * @name include
   * @alias contain
   * @alias includes
   * @alias contains
   * @param {Mixed} val
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function SameValueZero(a, b) {
    return (_.isNaN(a) && _.isNaN(b)) || a === b;
  }

  function includeChainingBehavior () {
    flag(this, 'contains', true);
  }

  function include (val, msg) {
    if (msg) flag(this, 'message', msg);

    var obj = flag(this, 'object')
      , objType = _.type(obj).toLowerCase()
      , flagMsg = flag(this, 'message')
      , negate = flag(this, 'negate')
      , ssfi = flag(this, 'ssfi')
      , isDeep = flag(this, 'deep')
      , descriptor = isDeep ? 'deep ' : '';

    flagMsg = flagMsg ? flagMsg + ': ' : '';

    var included = false;

    switch (objType) {
      case 'string':
        included = obj.indexOf(val) !== -1;
        break;

      case 'weakset':
        if (isDeep) {
          throw new AssertionError(
            flagMsg + 'unable to use .deep.include with WeakSet',
            undefined,
            ssfi
          );
        }

        included = obj.has(val);
        break;

      case 'map':
        var isEql = isDeep ? _.eql : SameValueZero;
        obj.forEach(function (item) {
          included = included || isEql(item, val);
        });
        break;

      case 'set':
        if (isDeep) {
          obj.forEach(function (item) {
            included = included || _.eql(item, val);
          });
        } else {
          included = obj.has(val);
        }
        break;

      case 'array':
        if (isDeep) {
          included = obj.some(function (item) {
            return _.eql(item, val);
          })
        } else {
          included = obj.indexOf(val) !== -1;
        }
        break;

      default:
        // This block is for asserting a subset of properties in an object.
        // `_.expectTypes` isn't used here because `.include` should work with
        // objects with a custom `@@toStringTag`.
        if (val !== Object(val)) {
          throw new AssertionError(
            flagMsg + 'the given combination of arguments ('
            + objType + ' and '
            + _.type(val).toLowerCase() + ')'
            + ' is invalid for this assertion. '
            + 'You can use an array, a map, an object, a set, a string, '
            + 'or a weakset instead of a '
            + _.type(val).toLowerCase(),
            undefined,
            ssfi
          );
        }

        var props = Object.keys(val)
          , firstErr = null
          , numErrs = 0;

        props.forEach(function (prop) {
          var propAssertion = new Assertion(obj);
          _.transferFlags(this, propAssertion, true);
          flag(propAssertion, 'lockSsfi', true);

          if (!negate || props.length === 1) {
            propAssertion.property(prop, val[prop]);
            return;
          }

          try {
            propAssertion.property(prop, val[prop]);
          } catch (err) {
            if (!_.checkError.compatibleConstructor(err, AssertionError)) {
              throw err;
            }
            if (firstErr === null) firstErr = err;
            numErrs++;
          }
        }, this);

        // When validating .not.include with multiple properties, we only want
        // to throw an assertion error if all of the properties are included,
        // in which case we throw the first property assertion error that we
        // encountered.
        if (negate && props.length > 1 && numErrs === props.length) {
          throw firstErr;
        }
        return;
    }

    // Assert inclusion in collection or substring in a string.
    this.assert(
      included
      , 'expected #{this} to ' + descriptor + 'include ' + _.inspect(val)
      , 'expected #{this} to not ' + descriptor + 'include ' + _.inspect(val));
  }

  Assertion.addChainableMethod('include', include, includeChainingBehavior);
  Assertion.addChainableMethod('contain', include, includeChainingBehavior);
  Assertion.addChainableMethod('contains', include, includeChainingBehavior);
  Assertion.addChainableMethod('includes', include, includeChainingBehavior);

  /**
   * ### .ok
   *
   * Asserts that the target is a truthy value (considered `true` in boolean context).
   * However, it's often best to assert that the target is strictly (`===`) or
   * deeply equal to its expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.ok; // Not recommended
   *
   *     expect(true).to.be.true; // Recommended
   *     expect(true).to.be.ok; // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.ok`.
   *
   *     expect(0).to.equal(0); // Recommended
   *     expect(0).to.not.be.ok; // Not recommended
   *
   *     expect(false).to.be.false; // Recommended
   *     expect(false).to.not.be.ok; // Not recommended
   *
   *     expect(null).to.be.null; // Recommended
   *     expect(null).to.not.be.ok; // Not recommended
   *
   *     expect(undefined).to.be.undefined; // Recommended
   *     expect(undefined).to.not.be.ok; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(false, 'nooo why fail??').to.be.ok;
   *
   * @name ok
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('ok', function () {
    this.assert(
        flag(this, 'object')
      , 'expected #{this} to be truthy'
      , 'expected #{this} to be falsy');
  });

  /**
   * ### .true
   *
   * Asserts that the target is strictly (`===`) equal to `true`.
   *
   *     expect(true).to.be.true;
   *
   * Add `.not` earlier in the chain to negate `.true`. However, it's often best
   * to assert that the target is equal to its expected value, rather than not
   * equal to `true`.
   *
   *     expect(false).to.be.false; // Recommended
   *     expect(false).to.not.be.true; // Not recommended
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.true; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(false, 'nooo why fail??').to.be.true;
   *
   * @name true
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('true', function () {
    this.assert(
        true === flag(this, 'object')
      , 'expected #{this} to be true'
      , 'expected #{this} to be false'
      , flag(this, 'negate') ? false : true
    );
  });

  /**
   * ### .false
   *
   * Asserts that the target is strictly (`===`) equal to `false`.
   *
   *     expect(false).to.be.false;
   *
   * Add `.not` earlier in the chain to negate `.false`. However, it's often
   * best to assert that the target is equal to its expected value, rather than
   * not equal to `false`.
   *
   *     expect(true).to.be.true; // Recommended
   *     expect(true).to.not.be.false; // Not recommended
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.false; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(true, 'nooo why fail??').to.be.false;
   *
   * @name false
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('false', function () {
    this.assert(
        false === flag(this, 'object')
      , 'expected #{this} to be false'
      , 'expected #{this} to be true'
      , flag(this, 'negate') ? true : false
    );
  });

  /**
   * ### .null
   *
   * Asserts that the target is strictly (`===`) equal to `null`.
   *
   *     expect(null).to.be.null;
   *
   * Add `.not` earlier in the chain to negate `.null`. However, it's often best
   * to assert that the target is equal to its expected value, rather than not
   * equal to `null`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.null; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(42, 'nooo why fail??').to.be.null;
   *
   * @name null
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('null', function () {
    this.assert(
        null === flag(this, 'object')
      , 'expected #{this} to be null'
      , 'expected #{this} not to be null'
    );
  });

  /**
   * ### .undefined
   *
   * Asserts that the target is strictly (`===`) equal to `undefined`.
   *
   *     expect(undefined).to.be.undefined;
   *
   * Add `.not` earlier in the chain to negate `.undefined`. However, it's often
   * best to assert that the target is equal to its expected value, rather than
   * not equal to `undefined`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.undefined; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(42, 'nooo why fail??').to.be.undefined;
   *
   * @name undefined
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('undefined', function () {
    this.assert(
        undefined === flag(this, 'object')
      , 'expected #{this} to be undefined'
      , 'expected #{this} not to be undefined'
    );
  });

  /**
   * ### .NaN
   *
   * Asserts that the target is exactly `NaN`.
   *
   *     expect(NaN).to.be.NaN;
   *
   * Add `.not` earlier in the chain to negate `.NaN`. However, it's often best
   * to assert that the target is equal to its expected value, rather than not
   * equal to `NaN`.
   *
   *     expect('foo').to.equal('foo'); // Recommended
   *     expect('foo').to.not.be.NaN; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(42, 'nooo why fail??').to.be.NaN;
   *
   * @name NaN
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('NaN', function () {
    this.assert(
        _.isNaN(flag(this, 'object'))
        , 'expected #{this} to be NaN'
        , 'expected #{this} not to be NaN'
    );
  });

  /**
   * ### .exist
   *
   * Asserts that the target is not strictly (`===`) equal to either `null` or
   * `undefined`. However, it's often best to assert that the target is equal to
   * its expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.exist; // Not recommended
   *
   *     expect(0).to.equal(0); // Recommended
   *     expect(0).to.exist; // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.exist`.
   *
   *     expect(null).to.be.null; // Recommended
   *     expect(null).to.not.exist; // Not recommended
   *
   *     expect(undefined).to.be.undefined; // Recommended
   *     expect(undefined).to.not.exist; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(null, 'nooo why fail??').to.exist;
   *
   * The alias `.exists` can be used interchangeably with `.exist`.
   *
   * @name exist
   * @alias exists
   * @namespace BDD
   * @api public
   */

  function assertExist () {
    var val = flag(this, 'object');
    this.assert(
        val !== null && val !== undefined
      , 'expected #{this} to exist'
      , 'expected #{this} to not exist'
    );
  }

  Assertion.addProperty('exist', assertExist);
  Assertion.addProperty('exists', assertExist);

  /**
   * ### .empty
   *
   * When the target is a string or array, `.empty` asserts that the target's
   * `length` property is strictly (`===`) equal to `0`.
   *
   *     expect([]).to.be.empty;
   *     expect('').to.be.empty;
   *
   * When the target is a map or set, `.empty` asserts that the target's `size`
   * property is strictly equal to `0`.
   *
   *     expect(new Set()).to.be.empty;
   *     expect(new Map()).to.be.empty;
   *
   * When the target is a non-function object, `.empty` asserts that the target
   * doesn't have any own enumerable properties. Properties with Symbol-based
   * keys are excluded from the count.
   *
   *     expect({}).to.be.empty;
   *
   * Because `.empty` does different things based on the target's type, it's
   * important to check the target's type before using `.empty`. See the `.a`
   * doc for info on testing a target's type.
   *
   *     expect([]).to.be.an('array').that.is.empty;
   *
   * Add `.not` earlier in the chain to negate `.empty`. However, it's often
   * best to assert that the target contains its expected number of values,
   * rather than asserting that it's not empty.
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.not.be.empty; // Not recommended
   *
   *     expect(new Set([1, 2, 3])).to.have.property('size', 3); // Recommended
   *     expect(new Set([1, 2, 3])).to.not.be.empty; // Not recommended
   *
   *     expect(Object.keys({a: 1})).to.have.lengthOf(1); // Recommended
   *     expect({a: 1}).to.not.be.empty; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect([1, 2, 3], 'nooo why fail??').to.be.empty;
   *
   * @name empty
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('empty', function () {
    var val = flag(this, 'object')
      , ssfi = flag(this, 'ssfi')
      , flagMsg = flag(this, 'message')
      , itemsCount;

    flagMsg = flagMsg ? flagMsg + ': ' : '';

    switch (_.type(val).toLowerCase()) {
      case 'array':
      case 'string':
        itemsCount = val.length;
        break;
      case 'map':
      case 'set':
        itemsCount = val.size;
        break;
      case 'weakmap':
      case 'weakset':
        throw new AssertionError(
          flagMsg + '.empty was passed a weak collection',
          undefined,
          ssfi
        );
      case 'function':
        var msg = flagMsg + '.empty was passed a function ' + _.getName(val);
        throw new AssertionError(msg.trim(), undefined, ssfi);
      default:
        if (val !== Object(val)) {
          throw new AssertionError(
            flagMsg + '.empty was passed non-string primitive ' + _.inspect(val),
            undefined,
            ssfi
          );
        }
        itemsCount = Object.keys(val).length;
    }

    this.assert(
        0 === itemsCount
      , 'expected #{this} to be empty'
      , 'expected #{this} not to be empty'
    );
  });

  /**
   * ### .arguments
   *
   * Asserts that the target is an `arguments` object.
   *
   *     function test () {
   *       expect(arguments).to.be.arguments;
   *     }
   *
   *     test();
   *
   * Add `.not` earlier in the chain to negate `.arguments`. However, it's often
   * best to assert which type the target is expected to be, rather than
   * asserting that it’s not an `arguments` object.
   *
   *     expect('foo').to.be.a('string'); // Recommended
   *     expect('foo').to.not.be.arguments; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({}, 'nooo why fail??').to.be.arguments;
   *
   * The alias `.Arguments` can be used interchangeably with `.arguments`.
   *
   * @name arguments
   * @alias Arguments
   * @namespace BDD
   * @api public
   */

  function checkArguments () {
    var obj = flag(this, 'object')
      , type = _.type(obj);
    this.assert(
        'Arguments' === type
      , 'expected #{this} to be arguments but got ' + type
      , 'expected #{this} to not be arguments'
    );
  }

  Assertion.addProperty('arguments', checkArguments);
  Assertion.addProperty('Arguments', checkArguments);

  /**
   * ### .equal(val[, msg])
   *
   * Asserts that the target is strictly (`===`) equal to the given `val`.
   *
   *     expect(1).to.equal(1);
   *     expect('foo').to.equal('foo');
   *
   * Add `.deep` earlier in the chain to use deep equality instead. See the
   * `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target object deeply (but not strictly) equals `{a: 1}`
   *     expect({a: 1}).to.deep.equal({a: 1});
   *     expect({a: 1}).to.not.equal({a: 1});
   *
   *     // Target array deeply (but not strictly) equals `[1, 2]`
   *     expect([1, 2]).to.deep.equal([1, 2]);
   *     expect([1, 2]).to.not.equal([1, 2]);
   *
   * Add `.not` earlier in the chain to negate `.equal`. However, it's often
   * best to assert that the target is equal to its expected value, rather than
   * not equal to one of countless unexpected values.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.equal(2); // Not recommended
   *
   * `.equal` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.equal(2, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.equal(2);
   *
   * The aliases `.equals` and `eq` can be used interchangeably with `.equal`.
   *
   * @name equal
   * @alias equals
   * @alias eq
   * @param {Mixed} val
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertEqual (val, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'deep')) {
      var prevLockSsfi = flag(this, 'lockSsfi');
      flag(this, 'lockSsfi', true);
      this.eql(val);
      flag(this, 'lockSsfi', prevLockSsfi);
    } else {
      this.assert(
          val === obj
        , 'expected #{this} to equal #{exp}'
        , 'expected #{this} to not equal #{exp}'
        , val
        , this._obj
        , true
      );
    }
  }

  Assertion.addMethod('equal', assertEqual);
  Assertion.addMethod('equals', assertEqual);
  Assertion.addMethod('eq', assertEqual);

  /**
   * ### .eql(obj[, msg])
   *
   * Asserts that the target is deeply equal to the given `obj`. See the
   * `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target object is deeply (but not strictly) equal to {a: 1}
   *     expect({a: 1}).to.eql({a: 1}).but.not.equal({a: 1});
   *
   *     // Target array is deeply (but not strictly) equal to [1, 2]
   *     expect([1, 2]).to.eql([1, 2]).but.not.equal([1, 2]);
   *
   * Add `.not` earlier in the chain to negate `.eql`. However, it's often best
   * to assert that the target is deeply equal to its expected value, rather
   * than not deeply equal to one of countless unexpected values.
   *
   *     expect({a: 1}).to.eql({a: 1}); // Recommended
   *     expect({a: 1}).to.not.eql({b: 2}); // Not recommended
   *
   * `.eql` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect({a: 1}).to.eql({b: 2}, 'nooo why fail??');
   *     expect({a: 1}, 'nooo why fail??').to.eql({b: 2});
   *
   * The alias `.eqls` can be used interchangeably with `.eql`.
   *
   * The `.deep.equal` assertion is almost identical to `.eql` but with one
   * difference: `.deep.equal` causes deep equality comparisons to also be used
   * for any other assertions that follow in the chain.
   *
   * @name eql
   * @alias eqls
   * @param {Mixed} obj
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertEql(obj, msg) {
    if (msg) flag(this, 'message', msg);
    this.assert(
        _.eql(obj, flag(this, 'object'))
      , 'expected #{this} to deeply equal #{exp}'
      , 'expected #{this} to not deeply equal #{exp}'
      , obj
      , this._obj
      , true
    );
  }

  Assertion.addMethod('eql', assertEql);
  Assertion.addMethod('eqls', assertEql);

  /**
   * ### .above(n[, msg])
   *
   * Asserts that the target is a number or a date greater than the given number or date `n` respectively.
   * However, it's often best to assert that the target is equal to its expected
   * value.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.be.above(1); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is greater than the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.above(2); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.above(2); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.above`.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(1).to.not.be.above(2); // Not recommended
   *
   * `.above` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.be.above(2, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.above(2);
   *
   * The aliases `.gt` and `.greaterThan` can be used interchangeably with
   * `.above`.
   *
   * @name above
   * @alias gt
   * @alias greaterThan
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertAbove (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to above must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to above must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount > n
        , 'expected #{this} to have a ' + descriptor + ' above #{exp} but got #{act}'
        , 'expected #{this} to not have a ' + descriptor + ' above #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj > n
        , 'expected #{this} to be above #{exp}'
        , 'expected #{this} to be at most #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('above', assertAbove);
  Assertion.addMethod('gt', assertAbove);
  Assertion.addMethod('greaterThan', assertAbove);

  /**
   * ### .least(n[, msg])
   *
   * Asserts that the target is a number or a date greater than or equal to the given
   * number or date `n` respectively. However, it's often best to assert that the target is equal to
   * its expected value.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.be.at.least(1); // Not recommended
   *     expect(2).to.be.at.least(2); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is greater than or equal to the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.at.least(2); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.at.least(2); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.least`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.at.least(2); // Not recommended
   *
   * `.least` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.be.at.least(2, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.at.least(2);
   *
   * The aliases `.gte` and `.greaterThanOrEqual` can be used interchangeably with
   * `.least`.
   *
   * @name least
   * @alias gte
   * @alias greaterThanOrEqual
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertLeast (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to least must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to least must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount >= n
        , 'expected #{this} to have a ' + descriptor + ' at least #{exp} but got #{act}'
        , 'expected #{this} to have a ' + descriptor + ' below #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj >= n
        , 'expected #{this} to be at least #{exp}'
        , 'expected #{this} to be below #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('least', assertLeast);
  Assertion.addMethod('gte', assertLeast);
  Assertion.addMethod('greaterThanOrEqual', assertLeast);

  /**
   * ### .below(n[, msg])
   *
   * Asserts that the target is a number or a date less than the given number or date `n` respectively.
   * However, it's often best to assert that the target is equal to its expected
   * value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.below(2); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is less than the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.below(4); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.length(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.below(4); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.below`.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.not.be.below(1); // Not recommended
   *
   * `.below` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(2).to.be.below(1, 'nooo why fail??');
   *     expect(2, 'nooo why fail??').to.be.below(1);
   *
   * The aliases `.lt` and `.lessThan` can be used interchangeably with
   * `.below`.
   *
   * @name below
   * @alias lt
   * @alias lessThan
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertBelow (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to below must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to below must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount < n
        , 'expected #{this} to have a ' + descriptor + ' below #{exp} but got #{act}'
        , 'expected #{this} to not have a ' + descriptor + ' below #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj < n
        , 'expected #{this} to be below #{exp}'
        , 'expected #{this} to be at least #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('below', assertBelow);
  Assertion.addMethod('lt', assertBelow);
  Assertion.addMethod('lessThan', assertBelow);

  /**
   * ### .most(n[, msg])
   *
   * Asserts that the target is a number or a date less than or equal to the given number
   * or date `n` respectively. However, it's often best to assert that the target is equal to its
   * expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.at.most(2); // Not recommended
   *     expect(1).to.be.at.most(1); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is less than or equal to the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.at.most(4); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.at.most(4); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.most`.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.not.be.at.most(1); // Not recommended
   *
   * `.most` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(2).to.be.at.most(1, 'nooo why fail??');
   *     expect(2, 'nooo why fail??').to.be.at.most(1);
   *
   * The aliases `.lte` and `.lessThanOrEqual` can be used interchangeably with
   * `.most`.
   *
   * @name most
   * @alias lte
   * @alias lessThanOrEqual
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertMost (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to most must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to most must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount <= n
        , 'expected #{this} to have a ' + descriptor + ' at most #{exp} but got #{act}'
        , 'expected #{this} to have a ' + descriptor + ' above #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj <= n
        , 'expected #{this} to be at most #{exp}'
        , 'expected #{this} to be above #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('most', assertMost);
  Assertion.addMethod('lte', assertMost);
  Assertion.addMethod('lessThanOrEqual', assertMost);

  /**
   * ### .within(start, finish[, msg])
   *
   * Asserts that the target is a number or a date greater than or equal to the given
   * number or date `start`, and less than or equal to the given number or date `finish` respectively.
   * However, it's often best to assert that the target is equal to its expected
   * value.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.be.within(1, 3); // Not recommended
   *     expect(2).to.be.within(2, 3); // Not recommended
   *     expect(2).to.be.within(1, 2); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is greater than or equal to the given number `start`, and less
   * than or equal to the given number `finish`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.within(2, 4); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.within(2, 4); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.within`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.within(2, 4); // Not recommended
   *
   * `.within` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(4).to.be.within(1, 3, 'nooo why fail??');
   *     expect(4, 'nooo why fail??').to.be.within(1, 3);
   *
   * @name within
   * @param {Number} start lower bound inclusive
   * @param {Number} finish upper bound inclusive
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  Assertion.addMethod('within', function (start, finish, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , startType = _.type(start).toLowerCase()
      , finishType = _.type(finish).toLowerCase()
      , errorMessage
      , shouldThrow = true
      , range = (startType === 'date' && finishType === 'date')
          ? start.toISOString() + '..' + finish.toISOString()
          : start + '..' + finish;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && (startType !== 'date' || finishType !== 'date'))) {
      errorMessage = msgPrefix + 'the arguments to within must be dates';
    } else if ((startType !== 'number' || finishType !== 'number') && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the arguments to within must be numbers';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount >= start && itemsCount <= finish
        , 'expected #{this} to have a ' + descriptor + ' within ' + range
        , 'expected #{this} to not have a ' + descriptor + ' within ' + range
      );
    } else {
      this.assert(
          obj >= start && obj <= finish
        , 'expected #{this} to be within ' + range
        , 'expected #{this} to not be within ' + range
      );
    }
  });

  /**
   * ### .instanceof(constructor[, msg])
   *
   * Asserts that the target is an instance of the given `constructor`.
   *
   *     function Cat () { }
   *
   *     expect(new Cat()).to.be.an.instanceof(Cat);
   *     expect([1, 2]).to.be.an.instanceof(Array);
   *
   * Add `.not` earlier in the chain to negate `.instanceof`.
   *
   *     expect({a: 1}).to.not.be.an.instanceof(Array);
   *
   * `.instanceof` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(1).to.be.an.instanceof(Array, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.an.instanceof(Array);
   *
   * Due to limitations in ES5, `.instanceof` may not always work as expected
   * when using a transpiler such as Babel or TypeScript. In particular, it may
   * produce unexpected results when subclassing built-in object such as
   * `Array`, `Error`, and `Map`. See your transpiler's docs for details:
   *
   * - ([Babel](https://babeljs.io/docs/usage/caveats/#classes))
   * - ([TypeScript](https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work))
   *
   * The alias `.instanceOf` can be used interchangeably with `.instanceof`.
   *
   * @name instanceof
   * @param {Constructor} constructor
   * @param {String} msg _optional_
   * @alias instanceOf
   * @namespace BDD
   * @api public
   */

  function assertInstanceOf (constructor, msg) {
    if (msg) flag(this, 'message', msg);

    var target = flag(this, 'object')
    var ssfi = flag(this, 'ssfi');
    var flagMsg = flag(this, 'message');

    try {
      var isInstanceOf = target instanceof constructor;
    } catch (err) {
      if (err instanceof TypeError) {
        flagMsg = flagMsg ? flagMsg + ': ' : '';
        throw new AssertionError(
          flagMsg + 'The instanceof assertion needs a constructor but '
            + _.type(constructor) + ' was given.',
          undefined,
          ssfi
        );
      }
      throw err;
    }

    var name = _.getName(constructor);
    if (name === null) {
      name = 'an unnamed constructor';
    }

    this.assert(
        isInstanceOf
      , 'expected #{this} to be an instance of ' + name
      , 'expected #{this} to not be an instance of ' + name
    );
  };

  Assertion.addMethod('instanceof', assertInstanceOf);
  Assertion.addMethod('instanceOf', assertInstanceOf);

  /**
   * ### .property(name[, val[, msg]])
   *
   * Asserts that the target has a property with the given key `name`.
   *
   *     expect({a: 1}).to.have.property('a');
   *
   * When `val` is provided, `.property` also asserts that the property's value
   * is equal to the given `val`.
   *
   *     expect({a: 1}).to.have.property('a', 1);
   *
   * By default, strict (`===`) equality is used. Add `.deep` earlier in the
   * chain to use deep equality instead. See the `deep-eql` project page for
   * info on the deep equality algorithm: https://github.com/chaijs/deep-eql.
   *
   *     // Target object deeply (but not strictly) has property `x: {a: 1}`
   *     expect({x: {a: 1}}).to.have.deep.property('x', {a: 1});
   *     expect({x: {a: 1}}).to.not.have.property('x', {a: 1});
   *
   * The target's enumerable and non-enumerable properties are always included
   * in the search. By default, both own and inherited properties are included.
   * Add `.own` earlier in the chain to exclude inherited properties from the
   * search.
   *
   *     Object.prototype.b = 2;
   *
   *     expect({a: 1}).to.have.own.property('a');
   *     expect({a: 1}).to.have.own.property('a', 1);
   *     expect({a: 1}).to.have.property('b');
   *     expect({a: 1}).to.not.have.own.property('b');
   *
   * `.deep` and `.own` can be combined.
   *
   *     expect({x: {a: 1}}).to.have.deep.own.property('x', {a: 1});
   *
   * Add `.nested` earlier in the chain to enable dot- and bracket-notation when
   * referencing nested properties.
   *
   *     expect({a: {b: ['x', 'y']}}).to.have.nested.property('a.b[1]');
   *     expect({a: {b: ['x', 'y']}}).to.have.nested.property('a.b[1]', 'y');
   *
   * If `.` or `[]` are part of an actual property name, they can be escaped by
   * adding two backslashes before them.
   *
   *     expect({'.a': {'[b]': 'x'}}).to.have.nested.property('\\.a.\\[b\\]');
   *
   * `.deep` and `.nested` can be combined.
   *
   *     expect({a: {b: [{c: 3}]}})
   *       .to.have.deep.nested.property('a.b[0]', {c: 3});
   *
   * `.own` and `.nested` cannot be combined.
   *
   * Add `.not` earlier in the chain to negate `.property`.
   *
   *     expect({a: 1}).to.not.have.property('b');
   *
   * However, it's dangerous to negate `.property` when providing `val`. The
   * problem is that it creates uncertain expectations by asserting that the
   * target either doesn't have a property with the given key `name`, or that it
   * does have a property with the given key `name` but its value isn't equal to
   * the given `val`. It's often best to identify the exact output that's
   * expected, and then write an assertion that only accepts that exact output.
   *
   * When the target isn't expected to have a property with the given key
   * `name`, it's often best to assert exactly that.
   *
   *     expect({b: 2}).to.not.have.property('a'); // Recommended
   *     expect({b: 2}).to.not.have.property('a', 1); // Not recommended
   *
   * When the target is expected to have a property with the given key `name`,
   * it's often best to assert that the property has its expected value, rather
   * than asserting that it doesn't have one of many unexpected values.
   *
   *     expect({a: 3}).to.have.property('a', 3); // Recommended
   *     expect({a: 3}).to.not.have.property('a', 1); // Not recommended
   *
   * `.property` changes the target of any assertions that follow in the chain
   * to be the value of the property from the original target object.
   *
   *     expect({a: 1}).to.have.property('a').that.is.a('number');
   *
   * `.property` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing `val`, only use the
   * second form.
   *
   *     // Recommended
   *     expect({a: 1}).to.have.property('a', 2, 'nooo why fail??');
   *     expect({a: 1}, 'nooo why fail??').to.have.property('a', 2);
   *     expect({a: 1}, 'nooo why fail??').to.have.property('b');
   *
   *     // Not recommended
   *     expect({a: 1}).to.have.property('b', undefined, 'nooo why fail??');
   *
   * The above assertion isn't the same thing as not providing `val`. Instead,
   * it's asserting that the target object has a `b` property that's equal to
   * `undefined`.
   *
   * The assertions `.ownProperty` and `.haveOwnProperty` can be used
   * interchangeably with `.own.property`.
   *
   * @name property
   * @param {String} name
   * @param {Mixed} val (optional)
   * @param {String} msg _optional_
   * @returns value of property for chaining
   * @namespace BDD
   * @api public
   */

  function assertProperty (name, val, msg) {
    if (msg) flag(this, 'message', msg);

    var isNested = flag(this, 'nested')
      , isOwn = flag(this, 'own')
      , flagMsg = flag(this, 'message')
      , obj = flag(this, 'object')
      , ssfi = flag(this, 'ssfi')
      , nameType = typeof name;

    flagMsg = flagMsg ? flagMsg + ': ' : '';

    if (isNested) {
      if (nameType !== 'string') {
        throw new AssertionError(
          flagMsg + 'the argument to property must be a string when using nested syntax',
          undefined,
          ssfi
        );
      }
    } else {
      if (nameType !== 'string' && nameType !== 'number' && nameType !== 'symbol') {
        throw new AssertionError(
          flagMsg + 'the argument to property must be a string, number, or symbol',
          undefined,
          ssfi
        );
      }
    }

    if (isNested && isOwn) {
      throw new AssertionError(
        flagMsg + 'The "nested" and "own" flags cannot be combined.',
        undefined,
        ssfi
      );
    }

    if (obj === null || obj === undefined) {
      throw new AssertionError(
        flagMsg + 'Target cannot be null or undefined.',
        undefined,
        ssfi
      );
    }

    var isDeep = flag(this, 'deep')
      , negate = flag(this, 'negate')
      , pathInfo = isNested ? _.getPathInfo(obj, name) : null
      , value = isNested ? pathInfo.value : obj[name];

    var descriptor = '';
    if (isDeep) descriptor += 'deep ';
    if (isOwn) descriptor += 'own ';
    if (isNested) descriptor += 'nested ';
    descriptor += 'property ';

    var hasProperty;
    if (isOwn) hasProperty = Object.prototype.hasOwnProperty.call(obj, name);
    else if (isNested) hasProperty = pathInfo.exists;
    else hasProperty = _.hasProperty(obj, name);

    // When performing a negated assertion for both name and val, merely having
    // a property with the given name isn't enough to cause the assertion to
    // fail. It must both have a property with the given name, and the value of
    // that property must equal the given val. Therefore, skip this assertion in
    // favor of the next.
    if (!negate || arguments.length === 1) {
      this.assert(
          hasProperty
        , 'expected #{this} to have ' + descriptor + _.inspect(name)
        , 'expected #{this} to not have ' + descriptor + _.inspect(name));
    }

    if (arguments.length > 1) {
      this.assert(
          hasProperty && (isDeep ? _.eql(val, value) : val === value)
        , 'expected #{this} to have ' + descriptor + _.inspect(name) + ' of #{exp}, but got #{act}'
        , 'expected #{this} to not have ' + descriptor + _.inspect(name) + ' of #{act}'
        , val
        , value
      );
    }

    flag(this, 'object', value);
  }

  Assertion.addMethod('property', assertProperty);

  function assertOwnProperty (name, value, msg) {
    flag(this, 'own', true);
    assertProperty.apply(this, arguments);
  }

  Assertion.addMethod('ownProperty', assertOwnProperty);
  Assertion.addMethod('haveOwnProperty', assertOwnProperty);

  /**
   * ### .ownPropertyDescriptor(name[, descriptor[, msg]])
   *
   * Asserts that the target has its own property descriptor with the given key
   * `name`. Enumerable and non-enumerable properties are included in the
   * search.
   *
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a');
   *
   * When `descriptor` is provided, `.ownPropertyDescriptor` also asserts that
   * the property's descriptor is deeply equal to the given `descriptor`. See
   * the `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 1,
   *     });
   *
   * Add `.not` earlier in the chain to negate `.ownPropertyDescriptor`.
   *
   *     expect({a: 1}).to.not.have.ownPropertyDescriptor('b');
   *
   * However, it's dangerous to negate `.ownPropertyDescriptor` when providing
   * a `descriptor`. The problem is that it creates uncertain expectations by
   * asserting that the target either doesn't have a property descriptor with
   * the given key `name`, or that it does have a property descriptor with the
   * given key `name` but it’s not deeply equal to the given `descriptor`. It's
   * often best to identify the exact output that's expected, and then write an
   * assertion that only accepts that exact output.
   *
   * When the target isn't expected to have a property descriptor with the given
   * key `name`, it's often best to assert exactly that.
   *
   *     // Recommended
   *     expect({b: 2}).to.not.have.ownPropertyDescriptor('a');
   *
   *     // Not recommended
   *     expect({b: 2}).to.not.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 1,
   *     });
   *
   * When the target is expected to have a property descriptor with the given
   * key `name`, it's often best to assert that the property has its expected
   * descriptor, rather than asserting that it doesn't have one of many
   * unexpected descriptors.
   *
   *     // Recommended
   *     expect({a: 3}).to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 3,
   *     });
   *
   *     // Not recommended
   *     expect({a: 3}).to.not.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 1,
   *     });
   *
   * `.ownPropertyDescriptor` changes the target of any assertions that follow
   * in the chain to be the value of the property descriptor from the original
   * target object.
   *
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a')
   *       .that.has.property('enumerable', true);
   *
   * `.ownPropertyDescriptor` accepts an optional `msg` argument which is a
   * custom error message to show when the assertion fails. The message can also
   * be given as the second argument to `expect`. When not providing
   * `descriptor`, only use the second form.
   *
   *     // Recommended
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 2,
   *     }, 'nooo why fail??');
   *
   *     // Recommended
   *     expect({a: 1}, 'nooo why fail??').to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 2,
   *     });
   *
   *     // Recommended
   *     expect({a: 1}, 'nooo why fail??').to.have.ownPropertyDescriptor('b');
   *
   *     // Not recommended
   *     expect({a: 1})
   *       .to.have.ownPropertyDescriptor('b', undefined, 'nooo why fail??');
   *
   * The above assertion isn't the same thing as not providing `descriptor`.
   * Instead, it's asserting that the target object has a `b` property
   * descriptor that's deeply equal to `undefined`.
   *
   * The alias `.haveOwnPropertyDescriptor` can be used interchangeably with
   * `.ownPropertyDescriptor`.
   *
   * @name ownPropertyDescriptor
   * @alias haveOwnPropertyDescriptor
   * @param {String} name
   * @param {Object} descriptor _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertOwnPropertyDescriptor (name, descriptor, msg) {
    if (typeof descriptor === 'string') {
      msg = descriptor;
      descriptor = null;
    }
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    var actualDescriptor = Object.getOwnPropertyDescriptor(Object(obj), name);
    if (actualDescriptor && descriptor) {
      this.assert(
          _.eql(descriptor, actualDescriptor)
        , 'expected the own property descriptor for ' + _.inspect(name) + ' on #{this} to match ' + _.inspect(descriptor) + ', got ' + _.inspect(actualDescriptor)
        , 'expected the own property descriptor for ' + _.inspect(name) + ' on #{this} to not match ' + _.inspect(descriptor)
        , descriptor
        , actualDescriptor
        , true
      );
    } else {
      this.assert(
          actualDescriptor
        , 'expected #{this} to have an own property descriptor for ' + _.inspect(name)
        , 'expected #{this} to not have an own property descriptor for ' + _.inspect(name)
      );
    }
    flag(this, 'object', actualDescriptor);
  }

  Assertion.addMethod('ownPropertyDescriptor', assertOwnPropertyDescriptor);
  Assertion.addMethod('haveOwnPropertyDescriptor', assertOwnPropertyDescriptor);

  /**
   * ### .lengthOf(n[, msg])
   *
   * Asserts that the target's `length` or `size` is equal to the given number
   * `n`.
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3);
   *     expect('foo').to.have.lengthOf(3);
   *     expect(new Set([1, 2, 3])).to.have.lengthOf(3);
   *     expect(new Map([['a', 1], ['b', 2], ['c', 3]])).to.have.lengthOf(3);
   *
   * Add `.not` earlier in the chain to negate `.lengthOf`. However, it's often
   * best to assert that the target's `length` property is equal to its expected
   * value, rather than not equal to one of many unexpected values.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.not.have.lengthOf(4); // Not recommended
   *
   * `.lengthOf` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect([1, 2, 3]).to.have.lengthOf(2, 'nooo why fail??');
   *     expect([1, 2, 3], 'nooo why fail??').to.have.lengthOf(2);
   *
   * `.lengthOf` can also be used as a language chain, causing all `.above`,
   * `.below`, `.least`, `.most`, and `.within` assertions that follow in the
   * chain to use the target's `length` property as the target. However, it's
   * often best to assert that the target's `length` property is equal to its
   * expected length, rather than asserting that its `length` property falls
   * within some range of values.
   *
   *     // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf(3);
   *
   *     // Not recommended
   *     expect([1, 2, 3]).to.have.lengthOf.above(2);
   *     expect([1, 2, 3]).to.have.lengthOf.below(4);
   *     expect([1, 2, 3]).to.have.lengthOf.at.least(3);
   *     expect([1, 2, 3]).to.have.lengthOf.at.most(3);
   *     expect([1, 2, 3]).to.have.lengthOf.within(2,4);
   *
   * Due to a compatibility issue, the alias `.length` can't be chained directly
   * off of an uninvoked method such as `.a`. Therefore, `.length` can't be used
   * interchangeably with `.lengthOf` in every situation. It's recommended to
   * always use `.lengthOf` instead of `.length`.
   *
   *     expect([1, 2, 3]).to.have.a.length(3); // incompatible; throws error
   *     expect([1, 2, 3]).to.have.a.lengthOf(3);  // passes as expected
   *
   * @name lengthOf
   * @alias length
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertLengthChain () {
    flag(this, 'doLength', true);
  }

  function assertLength (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , objType = _.type(obj).toLowerCase()
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi')
      , descriptor = 'length'
      , itemsCount;

    switch (objType) {
      case 'map':
      case 'set':
        descriptor = 'size';
        itemsCount = obj.size;
        break;
      default:
        new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
        itemsCount = obj.length;
    }

    this.assert(
        itemsCount == n
      , 'expected #{this} to have a ' + descriptor + ' of #{exp} but got #{act}'
      , 'expected #{this} to not have a ' + descriptor + ' of #{act}'
      , n
      , itemsCount
    );
  }

  Assertion.addChainableMethod('length', assertLength, assertLengthChain);
  Assertion.addChainableMethod('lengthOf', assertLength, assertLengthChain);

  /**
   * ### .match(re[, msg])
   *
   * Asserts that the target matches the given regular expression `re`.
   *
   *     expect('foobar').to.match(/^foo/);
   *
   * Add `.not` earlier in the chain to negate `.match`.
   *
   *     expect('foobar').to.not.match(/taco/);
   *
   * `.match` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect('foobar').to.match(/taco/, 'nooo why fail??');
   *     expect('foobar', 'nooo why fail??').to.match(/taco/);
   *
   * The alias `.matches` can be used interchangeably with `.match`.
   *
   * @name match
   * @alias matches
   * @param {RegExp} re
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */
  function assertMatch(re, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    this.assert(
        re.exec(obj)
      , 'expected #{this} to match ' + re
      , 'expected #{this} not to match ' + re
    );
  }

  Assertion.addMethod('match', assertMatch);
  Assertion.addMethod('matches', assertMatch);

  /**
   * ### .string(str[, msg])
   *
   * Asserts that the target string contains the given substring `str`.
   *
   *     expect('foobar').to.have.string('bar');
   *
   * Add `.not` earlier in the chain to negate `.string`.
   *
   *     expect('foobar').to.not.have.string('taco');
   *
   * `.string` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect('foobar').to.have.string('taco', 'nooo why fail??');
   *     expect('foobar', 'nooo why fail??').to.have.string('taco');
   *
   * @name string
   * @param {String} str
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  Assertion.addMethod('string', function (str, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(obj, flagMsg, ssfi, true).is.a('string');

    this.assert(
        ~obj.indexOf(str)
      , 'expected #{this} to contain ' + _.inspect(str)
      , 'expected #{this} to not contain ' + _.inspect(str)
    );
  });

  /**
   * ### .keys(key1[, key2[, ...]])
   *
   * Asserts that the target object, array, map, or set has the given keys. Only
   * the target's own inherited properties are included in the search.
   *
   * When the target is an object or array, keys can be provided as one or more
   * string arguments, a single array argument, or a single object argument. In
   * the latter case, only the keys in the given object matter; the values are
   * ignored.
   *
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b');
   *     expect(['x', 'y']).to.have.all.keys(0, 1);
   *
   *     expect({a: 1, b: 2}).to.have.all.keys(['a', 'b']);
   *     expect(['x', 'y']).to.have.all.keys([0, 1]);
   *
   *     expect({a: 1, b: 2}).to.have.all.keys({a: 4, b: 5}); // ignore 4 and 5
   *     expect(['x', 'y']).to.have.all.keys({0: 4, 1: 5}); // ignore 4 and 5
   *
   * When the target is a map or set, each key must be provided as a separate
   * argument.
   *
   *     expect(new Map([['a', 1], ['b', 2]])).to.have.all.keys('a', 'b');
   *     expect(new Set(['a', 'b'])).to.have.all.keys('a', 'b');
   *
   * Because `.keys` does different things based on the target's type, it's
   * important to check the target's type before using `.keys`. See the `.a` doc
   * for info on testing a target's type.
   *
   *     expect({a: 1, b: 2}).to.be.an('object').that.has.all.keys('a', 'b');
   *
   * By default, strict (`===`) equality is used to compare keys of maps and
   * sets. Add `.deep` earlier in the chain to use deep equality instead. See
   * the `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target set deeply (but not strictly) has key `{a: 1}`
   *     expect(new Set([{a: 1}])).to.have.all.deep.keys([{a: 1}]);
   *     expect(new Set([{a: 1}])).to.not.have.all.keys([{a: 1}]);
   *
   * By default, the target must have all of the given keys and no more. Add
   * `.any` earlier in the chain to only require that the target have at least
   * one of the given keys. Also, add `.not` earlier in the chain to negate
   * `.keys`. It's often best to add `.any` when negating `.keys`, and to use
   * `.all` when asserting `.keys` without negation.
   *
   * When negating `.keys`, `.any` is preferred because `.not.any.keys` asserts
   * exactly what's expected of the output, whereas `.not.all.keys` creates
   * uncertain expectations.
   *
   *     // Recommended; asserts that target doesn't have any of the given keys
   *     expect({a: 1, b: 2}).to.not.have.any.keys('c', 'd');
   *
   *     // Not recommended; asserts that target doesn't have all of the given
   *     // keys but may or may not have some of them
   *     expect({a: 1, b: 2}).to.not.have.all.keys('c', 'd');
   *
   * When asserting `.keys` without negation, `.all` is preferred because
   * `.all.keys` asserts exactly what's expected of the output, whereas
   * `.any.keys` creates uncertain expectations.
   *
   *     // Recommended; asserts that target has all the given keys
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b');
   *
   *     // Not recommended; asserts that target has at least one of the given
   *     // keys but may or may not have more of them
   *     expect({a: 1, b: 2}).to.have.any.keys('a', 'b');
   *
   * Note that `.all` is used by default when neither `.all` nor `.any` appear
   * earlier in the chain. However, it's often best to add `.all` anyway because
   * it improves readability.
   *
   *     // Both assertions are identical
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b'); // Recommended
   *     expect({a: 1, b: 2}).to.have.keys('a', 'b'); // Not recommended
   *
   * Add `.include` earlier in the chain to require that the target's keys be a
   * superset of the expected keys, rather than identical sets.
   *
   *     // Target object's keys are a superset of ['a', 'b'] but not identical
   *     expect({a: 1, b: 2, c: 3}).to.include.all.keys('a', 'b');
   *     expect({a: 1, b: 2, c: 3}).to.not.have.all.keys('a', 'b');
   *
   * However, if `.any` and `.include` are combined, only the `.any` takes
   * effect. The `.include` is ignored in this case.
   *
   *     // Both assertions are identical
   *     expect({a: 1}).to.have.any.keys('a', 'b');
   *     expect({a: 1}).to.include.any.keys('a', 'b');
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({a: 1}, 'nooo why fail??').to.have.key('b');
   *
   * The alias `.key` can be used interchangeably with `.keys`.
   *
   * @name keys
   * @alias key
   * @param {...String|Array|Object} keys
   * @namespace BDD
   * @api public
   */

  function assertKeys (keys) {
    var obj = flag(this, 'object')
      , objType = _.type(obj)
      , keysType = _.type(keys)
      , ssfi = flag(this, 'ssfi')
      , isDeep = flag(this, 'deep')
      , str
      , deepStr = ''
      , actual
      , ok = true
      , flagMsg = flag(this, 'message');

    flagMsg = flagMsg ? flagMsg + ': ' : '';
    var mixedArgsMsg = flagMsg + 'when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String arguments';

    if (objType === 'Map' || objType === 'Set') {
      deepStr = isDeep ? 'deeply ' : '';
      actual = [];

      // Map and Set '.keys' aren't supported in IE 11. Therefore, use .forEach.
      obj.forEach(function (val, key) { actual.push(key) });

      if (keysType !== 'Array') {
        keys = Array.prototype.slice.call(arguments);
      }
    } else {
      actual = _.getOwnEnumerableProperties(obj);

      switch (keysType) {
        case 'Array':
          if (arguments.length > 1) {
            throw new AssertionError(mixedArgsMsg, undefined, ssfi);
          }
          break;
        case 'Object':
          if (arguments.length > 1) {
            throw new AssertionError(mixedArgsMsg, undefined, ssfi);
          }
          keys = Object.keys(keys);
          break;
        default:
          keys = Array.prototype.slice.call(arguments);
      }

      // Only stringify non-Symbols because Symbols would become "Symbol()"
      keys = keys.map(function (val) {
        return typeof val === 'symbol' ? val : String(val);
      });
    }

    if (!keys.length) {
      throw new AssertionError(flagMsg + 'keys required', undefined, ssfi);
    }

    var len = keys.length
      , any = flag(this, 'any')
      , all = flag(this, 'all')
      , expected = keys;

    if (!any && !all) {
      all = true;
    }

    // Has any
    if (any) {
      ok = expected.some(function(expectedKey) {
        return actual.some(function(actualKey) {
          if (isDeep) {
            return _.eql(expectedKey, actualKey);
          } else {
            return expectedKey === actualKey;
          }
        });
      });
    }

    // Has all
    if (all) {
      ok = expected.every(function(expectedKey) {
        return actual.some(function(actualKey) {
          if (isDeep) {
            return _.eql(expectedKey, actualKey);
          } else {
            return expectedKey === actualKey;
          }
        });
      });

      if (!flag(this, 'contains')) {
        ok = ok && keys.length == actual.length;
      }
    }

    // Key string
    if (len > 1) {
      keys = keys.map(function(key) {
        return _.inspect(key);
      });
      var last = keys.pop();
      if (all) {
        str = keys.join(', ') + ', and ' + last;
      }
      if (any) {
        str = keys.join(', ') + ', or ' + last;
      }
    } else {
      str = _.inspect(keys[0]);
    }

    // Form
    str = (len > 1 ? 'keys ' : 'key ') + str;

    // Have / include
    str = (flag(this, 'contains') ? 'contain ' : 'have ') + str;

    // Assertion
    this.assert(
        ok
      , 'expected #{this} to ' + deepStr + str
      , 'expected #{this} to not ' + deepStr + str
      , expected.slice(0).sort(_.compareByInspect)
      , actual.sort(_.compareByInspect)
      , true
    );
  }

  Assertion.addMethod('keys', assertKeys);
  Assertion.addMethod('key', assertKeys);

  /**
   * ### .throw([errorLike], [errMsgMatcher], [msg])
   *
   * When no arguments are provided, `.throw` invokes the target function and
   * asserts that an error is thrown.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw();
   *
   * When one argument is provided, and it's an error constructor, `.throw`
   * invokes the target function and asserts that an error is thrown that's an
   * instance of that error constructor.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw(TypeError);
   *
   * When one argument is provided, and it's an error instance, `.throw` invokes
   * the target function and asserts that an error is thrown that's strictly
   * (`===`) equal to that error instance.
   *
   *     var err = new TypeError('Illegal salmon!');
   *     var badFn = function () { throw err; };
   *
   *     expect(badFn).to.throw(err);
   *
   * When one argument is provided, and it's a string, `.throw` invokes the
   * target function and asserts that an error is thrown with a message that
   * contains that string.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw('salmon');
   *
   * When one argument is provided, and it's a regular expression, `.throw`
   * invokes the target function and asserts that an error is thrown with a
   * message that matches that regular expression.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw(/salmon/);
   *
   * When two arguments are provided, and the first is an error instance or
   * constructor, and the second is a string or regular expression, `.throw`
   * invokes the function and asserts that an error is thrown that fulfills both
   * conditions as described above.
   *
   *     var err = new TypeError('Illegal salmon!');
   *     var badFn = function () { throw err; };
   *
   *     expect(badFn).to.throw(TypeError, 'salmon');
   *     expect(badFn).to.throw(TypeError, /salmon/);
   *     expect(badFn).to.throw(err, 'salmon');
   *     expect(badFn).to.throw(err, /salmon/);
   *
   * Add `.not` earlier in the chain to negate `.throw`.
   *
   *     var goodFn = function () {};
   *
   *     expect(goodFn).to.not.throw();
   *
   * However, it's dangerous to negate `.throw` when providing any arguments.
   * The problem is that it creates uncertain expectations by asserting that the
   * target either doesn't throw an error, or that it throws an error but of a
   * different type than the given type, or that it throws an error of the given
   * type but with a message that doesn't include the given string. It's often
   * best to identify the exact output that's expected, and then write an
   * assertion that only accepts that exact output.
   *
   * When the target isn't expected to throw an error, it's often best to assert
   * exactly that.
   *
   *     var goodFn = function () {};
   *
   *     expect(goodFn).to.not.throw(); // Recommended
   *     expect(goodFn).to.not.throw(ReferenceError, 'x'); // Not recommended
   *
   * When the target is expected to throw an error, it's often best to assert
   * that the error is of its expected type, and has a message that includes an
   * expected string, rather than asserting that it doesn't have one of many
   * unexpected types, and doesn't have a message that includes some string.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw(TypeError, 'salmon'); // Recommended
   *     expect(badFn).to.not.throw(ReferenceError, 'x'); // Not recommended
   *
   * `.throw` changes the target of any assertions that follow in the chain to
   * be the error object that's thrown.
   *
   *     var err = new TypeError('Illegal salmon!');
   *     err.code = 42;
   *     var badFn = function () { throw err; };
   *
   *     expect(badFn).to.throw(TypeError).with.property('code', 42);
   *
   * `.throw` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`. When not providing two arguments, always use
   * the second form.
   *
   *     var goodFn = function () {};
   *
   *     expect(goodFn).to.throw(TypeError, 'x', 'nooo why fail??');
   *     expect(goodFn, 'nooo why fail??').to.throw();
   *
   * Due to limitations in ES5, `.throw` may not always work as expected when
   * using a transpiler such as Babel or TypeScript. In particular, it may
   * produce unexpected results when subclassing the built-in `Error` object and
   * then passing the subclassed constructor to `.throw`. See your transpiler's
   * docs for details:
   *
   * - ([Babel](https://babeljs.io/docs/usage/caveats/#classes))
   * - ([TypeScript](https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work))
   *
   * Beware of some common mistakes when using the `throw` assertion. One common
   * mistake is to accidentally invoke the function yourself instead of letting
   * the `throw` assertion invoke the function for you. For example, when
   * testing if a function named `fn` throws, provide `fn` instead of `fn()` as
   * the target for the assertion.
   *
   *     expect(fn).to.throw();     // Good! Tests `fn` as desired
   *     expect(fn()).to.throw();   // Bad! Tests result of `fn()`, not `fn`
   *
   * If you need to assert that your function `fn` throws when passed certain
   * arguments, then wrap a call to `fn` inside of another function.
   *
   *     expect(function () { fn(42); }).to.throw();  // Function expression
   *     expect(() => fn(42)).to.throw();             // ES6 arrow function
   *
   * Another common mistake is to provide an object method (or any stand-alone
   * function that relies on `this`) as the target of the assertion. Doing so is
   * problematic because the `this` context will be lost when the function is
   * invoked by `.throw`; there's no way for it to know what `this` is supposed
   * to be. There are two ways around this problem. One solution is to wrap the
   * method or function call inside of another function. Another solution is to
   * use `bind`.
   *
   *     expect(function () { cat.meow(); }).to.throw();  // Function expression
   *     expect(() => cat.meow()).to.throw();             // ES6 arrow function
   *     expect(cat.meow.bind(cat)).to.throw();           // Bind
   *
   * Finally, it's worth mentioning that it's a best practice in JavaScript to
   * only throw `Error` and derivatives of `Error` such as `ReferenceError`,
   * `TypeError`, and user-defined objects that extend `Error`. No other type of
   * value will generate a stack trace when initialized. With that said, the
   * `throw` assertion does technically support any type of value being thrown,
   * not just `Error` and its derivatives.
   *
   * The aliases `.throws` and `.Throw` can be used interchangeably with
   * `.throw`.
   *
   * @name throw
   * @alias throws
   * @alias Throw
   * @param {Error|ErrorConstructor} errorLike
   * @param {String|RegExp} errMsgMatcher error message
   * @param {String} msg _optional_
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @returns error for chaining (null if no error)
   * @namespace BDD
   * @api public
   */

  function assertThrows (errorLike, errMsgMatcher, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , ssfi = flag(this, 'ssfi')
      , flagMsg = flag(this, 'message')
      , negate = flag(this, 'negate') || false;
    new Assertion(obj, flagMsg, ssfi, true).is.a('function');

    if (errorLike instanceof RegExp || typeof errorLike === 'string') {
      errMsgMatcher = errorLike;
      errorLike = null;
    }

    var caughtErr;
    try {
      obj();
    } catch (err) {
      caughtErr = err;
    }

    // If we have the negate flag enabled and at least one valid argument it means we do expect an error
    // but we want it to match a given set of criteria
    var everyArgIsUndefined = errorLike === undefined && errMsgMatcher === undefined;

    // If we've got the negate flag enabled and both args, we should only fail if both aren't compatible
    // See Issue #551 and PR #683@GitHub
    var everyArgIsDefined = Boolean(errorLike && errMsgMatcher);
    var errorLikeFail = false;
    var errMsgMatcherFail = false;

    // Checking if error was thrown
    if (everyArgIsUndefined || !everyArgIsUndefined && !negate) {
      // We need this to display results correctly according to their types
      var errorLikeString = 'an error';
      if (errorLike instanceof Error) {
        errorLikeString = '#{exp}';
      } else if (errorLike) {
        errorLikeString = _.checkError.getConstructorName(errorLike);
      }

      this.assert(
          caughtErr
        , 'expected #{this} to throw ' + errorLikeString
        , 'expected #{this} to not throw an error but #{act} was thrown'
        , errorLike && errorLike.toString()
        , (caughtErr instanceof Error ?
            caughtErr.toString() : (typeof caughtErr === 'string' ? caughtErr : caughtErr &&
                                    _.checkError.getConstructorName(caughtErr)))
      );
    }

    if (errorLike && caughtErr) {
      // We should compare instances only if `errorLike` is an instance of `Error`
      if (errorLike instanceof Error) {
        var isCompatibleInstance = _.checkError.compatibleInstance(caughtErr, errorLike);

        if (isCompatibleInstance === negate) {
          // These checks were created to ensure we won't fail too soon when we've got both args and a negate
          // See Issue #551 and PR #683@GitHub
          if (everyArgIsDefined && negate) {
            errorLikeFail = true;
          } else {
            this.assert(
                negate
              , 'expected #{this} to throw #{exp} but #{act} was thrown'
              , 'expected #{this} to not throw #{exp}' + (caughtErr && !negate ? ' but #{act} was thrown' : '')
              , errorLike.toString()
              , caughtErr.toString()
            );
          }
        }
      }

      var isCompatibleConstructor = _.checkError.compatibleConstructor(caughtErr, errorLike);
      if (isCompatibleConstructor === negate) {
        if (everyArgIsDefined && negate) {
            errorLikeFail = true;
        } else {
          this.assert(
              negate
            , 'expected #{this} to throw #{exp} but #{act} was thrown'
            , 'expected #{this} to not throw #{exp}' + (caughtErr ? ' but #{act} was thrown' : '')
            , (errorLike instanceof Error ? errorLike.toString() : errorLike && _.checkError.getConstructorName(errorLike))
            , (caughtErr instanceof Error ? caughtErr.toString() : caughtErr && _.checkError.getConstructorName(caughtErr))
          );
        }
      }
    }

    if (caughtErr && errMsgMatcher !== undefined && errMsgMatcher !== null) {
      // Here we check compatible messages
      var placeholder = 'including';
      if (errMsgMatcher instanceof RegExp) {
        placeholder = 'matching'
      }

      var isCompatibleMessage = _.checkError.compatibleMessage(caughtErr, errMsgMatcher);
      if (isCompatibleMessage === negate) {
        if (everyArgIsDefined && negate) {
            errMsgMatcherFail = true;
        } else {
          this.assert(
            negate
            , 'expected #{this} to throw error ' + placeholder + ' #{exp} but got #{act}'
            , 'expected #{this} to throw error not ' + placeholder + ' #{exp}'
            ,  errMsgMatcher
            ,  _.checkError.getMessage(caughtErr)
          );
        }
      }
    }

    // If both assertions failed and both should've matched we throw an error
    if (errorLikeFail && errMsgMatcherFail) {
      this.assert(
        negate
        , 'expected #{this} to throw #{exp} but #{act} was thrown'
        , 'expected #{this} to not throw #{exp}' + (caughtErr ? ' but #{act} was thrown' : '')
        , (errorLike instanceof Error ? errorLike.toString() : errorLike && _.checkError.getConstructorName(errorLike))
        , (caughtErr instanceof Error ? caughtErr.toString() : caughtErr && _.checkError.getConstructorName(caughtErr))
      );
    }

    flag(this, 'object', caughtErr);
  };

  Assertion.addMethod('throw', assertThrows);
  Assertion.addMethod('throws', assertThrows);
  Assertion.addMethod('Throw', assertThrows);

  /**
   * ### .respondTo(method[, msg])
   *
   * When the target is a non-function object, `.respondTo` asserts that the
   * target has a method with the given name `method`. The method can be own or
   * inherited, and it can be enumerable or non-enumerable.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *
   *     expect(new Cat()).to.respondTo('meow');
   *
   * When the target is a function, `.respondTo` asserts that the target's
   * `prototype` property has a method with the given name `method`. Again, the
   * method can be own or inherited, and it can be enumerable or non-enumerable.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *
   *     expect(Cat).to.respondTo('meow');
   *
   * Add `.itself` earlier in the chain to force `.respondTo` to treat the
   * target as a non-function object, even if it's a function. Thus, it asserts
   * that the target has a method with the given name `method`, rather than
   * asserting that the target's `prototype` property has a method with the
   * given name `method`.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *     Cat.hiss = function () {};
   *
   *     expect(Cat).itself.to.respondTo('hiss').but.not.respondTo('meow');
   *
   * When not adding `.itself`, it's important to check the target's type before
   * using `.respondTo`. See the `.a` doc for info on checking a target's type.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *
   *     expect(new Cat()).to.be.an('object').that.respondsTo('meow');
   *
   * Add `.not` earlier in the chain to negate `.respondTo`.
   *
   *     function Dog () {}
   *     Dog.prototype.bark = function () {};
   *
   *     expect(new Dog()).to.not.respondTo('meow');
   *
   * `.respondTo` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect({}).to.respondTo('meow', 'nooo why fail??');
   *     expect({}, 'nooo why fail??').to.respondTo('meow');
   *
   * The alias `.respondsTo` can be used interchangeably with `.respondTo`.
   *
   * @name respondTo
   * @alias respondsTo
   * @param {String} method
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function respondTo (method, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , itself = flag(this, 'itself')
      , context = ('function' === typeof obj && !itself)
        ? obj.prototype[method]
        : obj[method];

    this.assert(
        'function' === typeof context
      , 'expected #{this} to respond to ' + _.inspect(method)
      , 'expected #{this} to not respond to ' + _.inspect(method)
    );
  }

  Assertion.addMethod('respondTo', respondTo);
  Assertion.addMethod('respondsTo', respondTo);

  /**
   * ### .itself
   *
   * Forces all `.respondTo` assertions that follow in the chain to behave as if
   * the target is a non-function object, even if it's a function. Thus, it
   * causes `.respondTo` to assert that the target has a method with the given
   * name, rather than asserting that the target's `prototype` property has a
   * method with the given name.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *     Cat.hiss = function () {};
   *
   *     expect(Cat).itself.to.respondTo('hiss').but.not.respondTo('meow');
   *
   * @name itself
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('itself', function () {
    flag(this, 'itself', true);
  });

  /**
   * ### .satisfy(matcher[, msg])
   *
   * Invokes the given `matcher` function with the target being passed as the
   * first argument, and asserts that the value returned is truthy.
   *
   *     expect(1).to.satisfy(function(num) {
   *       return num > 0;
   *     });
   *
   * Add `.not` earlier in the chain to negate `.satisfy`.
   *
   *     expect(1).to.not.satisfy(function(num) {
   *       return num > 2;
   *     });
   *
   * `.satisfy` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(1).to.satisfy(function(num) {
   *       return num > 2;
   *     }, 'nooo why fail??');
   *
   *     expect(1, 'nooo why fail??').to.satisfy(function(num) {
   *       return num > 2;
   *     });
   *
   * The alias `.satisfies` can be used interchangeably with `.satisfy`.
   *
   * @name satisfy
   * @alias satisfies
   * @param {Function} matcher
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function satisfy (matcher, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    var result = matcher(obj);
    this.assert(
        result
      , 'expected #{this} to satisfy ' + _.objDisplay(matcher)
      , 'expected #{this} to not satisfy' + _.objDisplay(matcher)
      , flag(this, 'negate') ? false : true
      , result
    );
  }

  Assertion.addMethod('satisfy', satisfy);
  Assertion.addMethod('satisfies', satisfy);

  /**
   * ### .closeTo(expected, delta[, msg])
   *
   * Asserts that the target is a number that's within a given +/- `delta` range
   * of the given number `expected`. However, it's often best to assert that the
   * target is equal to its expected value.
   *
   *     // Recommended
   *     expect(1.5).to.equal(1.5);
   *
   *     // Not recommended
   *     expect(1.5).to.be.closeTo(1, 0.5);
   *     expect(1.5).to.be.closeTo(2, 0.5);
   *     expect(1.5).to.be.closeTo(1, 1);
   *
   * Add `.not` earlier in the chain to negate `.closeTo`.
   *
   *     expect(1.5).to.equal(1.5); // Recommended
   *     expect(1.5).to.not.be.closeTo(3, 1); // Not recommended
   *
   * `.closeTo` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(1.5).to.be.closeTo(3, 1, 'nooo why fail??');
   *     expect(1.5, 'nooo why fail??').to.be.closeTo(3, 1);
   *
   * The alias `.approximately` can be used interchangeably with `.closeTo`.
   *
   * @name closeTo
   * @alias approximately
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function closeTo(expected, delta, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');

    new Assertion(obj, flagMsg, ssfi, true).is.a('number');
    if (typeof expected !== 'number' || typeof delta !== 'number') {
      flagMsg = flagMsg ? flagMsg + ': ' : '';
      var deltaMessage = delta === undefined ? ", and a delta is required" : "";
      throw new AssertionError(
          flagMsg + 'the arguments to closeTo or approximately must be numbers' + deltaMessage,
          undefined,
          ssfi
      );
    }

    this.assert(
        Math.abs(obj - expected) <= delta
      , 'expected #{this} to be close to ' + expected + ' +/- ' + delta
      , 'expected #{this} not to be close to ' + expected + ' +/- ' + delta
    );
  }

  Assertion.addMethod('closeTo', closeTo);
  Assertion.addMethod('approximately', closeTo);

  // Note: Duplicates are ignored if testing for inclusion instead of sameness.
  function isSubsetOf(subset, superset, cmp, contains, ordered) {
    if (!contains) {
      if (subset.length !== superset.length) return false;
      superset = superset.slice();
    }

    return subset.every(function(elem, idx) {
      if (ordered) return cmp ? cmp(elem, superset[idx]) : elem === superset[idx];

      if (!cmp) {
        var matchIdx = superset.indexOf(elem);
        if (matchIdx === -1) return false;

        // Remove match from superset so not counted twice if duplicate in subset.
        if (!contains) superset.splice(matchIdx, 1);
        return true;
      }

      return superset.some(function(elem2, matchIdx) {
        if (!cmp(elem, elem2)) return false;

        // Remove match from superset so not counted twice if duplicate in subset.
        if (!contains) superset.splice(matchIdx, 1);
        return true;
      });
    });
  }

  /**
   * ### .members(set[, msg])
   *
   * Asserts that the target array has the same members as the given array
   * `set`.
   *
   *     expect([1, 2, 3]).to.have.members([2, 1, 3]);
   *     expect([1, 2, 2]).to.have.members([2, 1, 2]);
   *
   * By default, members are compared using strict (`===`) equality. Add `.deep`
   * earlier in the chain to use deep equality instead. See the `deep-eql`
   * project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target array deeply (but not strictly) has member `{a: 1}`
   *     expect([{a: 1}]).to.have.deep.members([{a: 1}]);
   *     expect([{a: 1}]).to.not.have.members([{a: 1}]);
   *
   * By default, order doesn't matter. Add `.ordered` earlier in the chain to
   * require that members appear in the same order.
   *
   *     expect([1, 2, 3]).to.have.ordered.members([1, 2, 3]);
   *     expect([1, 2, 3]).to.have.members([2, 1, 3])
   *       .but.not.ordered.members([2, 1, 3]);
   *
   * By default, both arrays must be the same size. Add `.include` earlier in
   * the chain to require that the target's members be a superset of the
   * expected members. Note that duplicates are ignored in the subset when
   * `.include` is added.
   *
   *     // Target array is a superset of [1, 2] but not identical
   *     expect([1, 2, 3]).to.include.members([1, 2]);
   *     expect([1, 2, 3]).to.not.have.members([1, 2]);
   *
   *     // Duplicates in the subset are ignored
   *     expect([1, 2, 3]).to.include.members([1, 2, 2, 2]);
   *
   * `.deep`, `.ordered`, and `.include` can all be combined. However, if
   * `.include` and `.ordered` are combined, the ordering begins at the start of
   * both arrays.
   *
   *     expect([{a: 1}, {b: 2}, {c: 3}])
   *       .to.include.deep.ordered.members([{a: 1}, {b: 2}])
   *       .but.not.include.deep.ordered.members([{b: 2}, {c: 3}]);
   *
   * Add `.not` earlier in the chain to negate `.members`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the target array doesn't have all of the same members as
   * the given array `set` but may or may not have some of them. It's often best
   * to identify the exact output that's expected, and then write an assertion
   * that only accepts that exact output.
   *
   *     expect([1, 2]).to.not.include(3).and.not.include(4); // Recommended
   *     expect([1, 2]).to.not.have.members([3, 4]); // Not recommended
   *
   * `.members` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect([1, 2]).to.have.members([1, 2, 3], 'nooo why fail??');
   *     expect([1, 2], 'nooo why fail??').to.have.members([1, 2, 3]);
   *
   * @name members
   * @param {Array} set
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  Assertion.addMethod('members', function (subset, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');

    new Assertion(obj, flagMsg, ssfi, true).to.be.an('array');
    new Assertion(subset, flagMsg, ssfi, true).to.be.an('array');

    var contains = flag(this, 'contains');
    var ordered = flag(this, 'ordered');

    var subject, failMsg, failNegateMsg;

    if (contains) {
      subject = ordered ? 'an ordered superset' : 'a superset';
      failMsg = 'expected #{this} to be ' + subject + ' of #{exp}';
      failNegateMsg = 'expected #{this} to not be ' + subject + ' of #{exp}';
    } else {
      subject = ordered ? 'ordered members' : 'members';
      failMsg = 'expected #{this} to have the same ' + subject + ' as #{exp}';
      failNegateMsg = 'expected #{this} to not have the same ' + subject + ' as #{exp}';
    }

    var cmp = flag(this, 'deep') ? _.eql : undefined;

    this.assert(
        isSubsetOf(subset, obj, cmp, contains, ordered)
      , failMsg
      , failNegateMsg
      , subset
      , obj
      , true
    );
  });

  /**
   * ### .oneOf(list[, msg])
   *
   * Asserts that the target is a member of the given array `list`. However,
   * it's often best to assert that the target is equal to its expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.oneOf([1, 2, 3]); // Not recommended
   *
   * Comparisons are performed using strict (`===`) equality.
   *
   * Add `.not` earlier in the chain to negate `.oneOf`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.oneOf([2, 3, 4]); // Not recommended
   *
   * It can also be chained with `.contain` or `.include`, which will work with
   * both arrays and strings:
   *
   *     expect('Today is sunny').to.contain.oneOf(['sunny', 'cloudy'])
   *     expect('Today is rainy').to.not.contain.oneOf(['sunny', 'cloudy'])
   *     expect([1,2,3]).to.contain.oneOf([3,4,5])
   *     expect([1,2,3]).to.not.contain.oneOf([4,5,6])
   *
   * `.oneOf` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.be.oneOf([2, 3, 4], 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.oneOf([2, 3, 4]);
   *
   * @name oneOf
   * @param {Array<*>} list
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function oneOf (list, msg) {
    if (msg) flag(this, 'message', msg);
    var expected = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi')
      , contains = flag(this, 'contains')
      , isDeep = flag(this, 'deep');
    new Assertion(list, flagMsg, ssfi, true).to.be.an('array');

    if (contains) {
      this.assert(
        list.some(function(possibility) { return expected.indexOf(possibility) > -1 })
        , 'expected #{this} to contain one of #{exp}'
        , 'expected #{this} to not contain one of #{exp}'
        , list
        , expected
      );
    } else {
      if (isDeep) {
        this.assert(
          list.some(function(possibility) { return _.eql(expected, possibility) })
          , 'expected #{this} to deeply equal one of #{exp}'
          , 'expected #{this} to deeply equal one of #{exp}'
          , list
          , expected
        );
      } else {
        this.assert(
          list.indexOf(expected) > -1
          , 'expected #{this} to be one of #{exp}'
          , 'expected #{this} to not be one of #{exp}'
          , list
          , expected
        );
      }
    }
  }

  Assertion.addMethod('oneOf', oneOf);

  /**
   * ### .change(subject[, prop[, msg]])
   *
   * When one argument is provided, `.change` asserts that the given function
   * `subject` returns a different value when it's invoked before the target
   * function compared to when it's invoked afterward. However, it's often best
   * to assert that `subject` is equal to its expected value.
   *
   *     var dots = ''
   *       , addDot = function () { dots += '.'; }
   *       , getDots = function () { return dots; };
   *
   *     // Recommended
   *     expect(getDots()).to.equal('');
   *     addDot();
   *     expect(getDots()).to.equal('.');
   *
   *     // Not recommended
   *     expect(addDot).to.change(getDots);
   *
   * When two arguments are provided, `.change` asserts that the value of the
   * given object `subject`'s `prop` property is different before invoking the
   * target function compared to afterward.
   *
   *     var myObj = {dots: ''}
   *       , addDot = function () { myObj.dots += '.'; };
   *
   *     // Recommended
   *     expect(myObj).to.have.property('dots', '');
   *     addDot();
   *     expect(myObj).to.have.property('dots', '.');
   *
   *     // Not recommended
   *     expect(addDot).to.change(myObj, 'dots');
   *
   * Strict (`===`) equality is used to compare before and after values.
   *
   * Add `.not` earlier in the chain to negate `.change`.
   *
   *     var dots = ''
   *       , noop = function () {}
   *       , getDots = function () { return dots; };
   *
   *     expect(noop).to.not.change(getDots);
   *
   *     var myObj = {dots: ''}
   *       , noop = function () {};
   *
   *     expect(noop).to.not.change(myObj, 'dots');
   *
   * `.change` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing two arguments, always
   * use the second form.
   *
   *     var myObj = {dots: ''}
   *       , addDot = function () { myObj.dots += '.'; };
   *
   *     expect(addDot).to.not.change(myObj, 'dots', 'nooo why fail??');
   *
   *     var dots = ''
   *       , addDot = function () { dots += '.'; }
   *       , getDots = function () { return dots; };
   *
   *     expect(addDot, 'nooo why fail??').to.not.change(getDots);
   *
   * `.change` also causes all `.by` assertions that follow in the chain to
   * assert how much a numeric subject was increased or decreased by. However,
   * it's dangerous to use `.change.by`. The problem is that it creates
   * uncertain expectations by asserting that the subject either increases by
   * the given delta, or that it decreases by the given delta. It's often best
   * to identify the exact output that's expected, and then write an assertion
   * that only accepts that exact output.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; }
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   * The alias `.changes` can be used interchangeably with `.change`.
   *
   * @name change
   * @alias changes
   * @param {String} subject
   * @param {String} prop name _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertChanges (subject, prop, msg) {
    if (msg) flag(this, 'message', msg);
    var fn = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(fn, flagMsg, ssfi, true).is.a('function');

    var initial;
    if (!prop) {
      new Assertion(subject, flagMsg, ssfi, true).is.a('function');
      initial = subject();
    } else {
      new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
      initial = subject[prop];
    }

    fn();

    var final = prop === undefined || prop === null ? subject() : subject[prop];
    var msgObj = prop === undefined || prop === null ? initial : '.' + prop;

    // This gets flagged because of the .by(delta) assertion
    flag(this, 'deltaMsgObj', msgObj);
    flag(this, 'initialDeltaValue', initial);
    flag(this, 'finalDeltaValue', final);
    flag(this, 'deltaBehavior', 'change');
    flag(this, 'realDelta', final !== initial);

    this.assert(
      initial !== final
      , 'expected ' + msgObj + ' to change'
      , 'expected ' + msgObj + ' to not change'
    );
  }

  Assertion.addMethod('change', assertChanges);
  Assertion.addMethod('changes', assertChanges);

  /**
   * ### .increase(subject[, prop[, msg]])
   *
   * When one argument is provided, `.increase` asserts that the given function
   * `subject` returns a greater number when it's invoked after invoking the
   * target function compared to when it's invoked beforehand. `.increase` also
   * causes all `.by` assertions that follow in the chain to assert how much
   * greater of a number is returned. It's often best to assert that the return
   * value increased by the expected amount, rather than asserting it increased
   * by any amount.
   *
   *     var val = 1
   *       , addTwo = function () { val += 2; }
   *       , getVal = function () { return val; };
   *
   *     expect(addTwo).to.increase(getVal).by(2); // Recommended
   *     expect(addTwo).to.increase(getVal); // Not recommended
   *
   * When two arguments are provided, `.increase` asserts that the value of the
   * given object `subject`'s `prop` property is greater after invoking the
   * target function compared to beforehand.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.increase(myObj, 'val'); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.increase`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the subject either decreases, or that it stays the same.
   * It's often best to identify the exact output that's expected, and then
   * write an assertion that only accepts that exact output.
   *
   * When the subject is expected to decrease, it's often best to assert that it
   * decreased by the expected amount.
   *
   *     var myObj = {val: 1}
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.not.increase(myObj, 'val'); // Not recommended
   *
   * When the subject is expected to stay the same, it's often best to assert
   * exactly that.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.not.change(myObj, 'val'); // Recommended
   *     expect(noop).to.not.increase(myObj, 'val'); // Not recommended
   *
   * `.increase` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing two arguments, always
   * use the second form.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.increase(myObj, 'val', 'nooo why fail??');
   *
   *     var val = 1
   *       , noop = function () {}
   *       , getVal = function () { return val; };
   *
   *     expect(noop, 'nooo why fail??').to.increase(getVal);
   *
   * The alias `.increases` can be used interchangeably with `.increase`.
   *
   * @name increase
   * @alias increases
   * @param {String|Function} subject
   * @param {String} prop name _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertIncreases (subject, prop, msg) {
    if (msg) flag(this, 'message', msg);
    var fn = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(fn, flagMsg, ssfi, true).is.a('function');

    var initial;
    if (!prop) {
      new Assertion(subject, flagMsg, ssfi, true).is.a('function');
      initial = subject();
    } else {
      new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
      initial = subject[prop];
    }

    // Make sure that the target is a number
    new Assertion(initial, flagMsg, ssfi, true).is.a('number');

    fn();

    var final = prop === undefined || prop === null ? subject() : subject[prop];
    var msgObj = prop === undefined || prop === null ? initial : '.' + prop;

    flag(this, 'deltaMsgObj', msgObj);
    flag(this, 'initialDeltaValue', initial);
    flag(this, 'finalDeltaValue', final);
    flag(this, 'deltaBehavior', 'increase');
    flag(this, 'realDelta', final - initial);

    this.assert(
      final - initial > 0
      , 'expected ' + msgObj + ' to increase'
      , 'expected ' + msgObj + ' to not increase'
    );
  }

  Assertion.addMethod('increase', assertIncreases);
  Assertion.addMethod('increases', assertIncreases);

  /**
   * ### .decrease(subject[, prop[, msg]])
   *
   * When one argument is provided, `.decrease` asserts that the given function
   * `subject` returns a lesser number when it's invoked after invoking the
   * target function compared to when it's invoked beforehand. `.decrease` also
   * causes all `.by` assertions that follow in the chain to assert how much
   * lesser of a number is returned. It's often best to assert that the return
   * value decreased by the expected amount, rather than asserting it decreased
   * by any amount.
   *
   *     var val = 1
   *       , subtractTwo = function () { val -= 2; }
   *       , getVal = function () { return val; };
   *
   *     expect(subtractTwo).to.decrease(getVal).by(2); // Recommended
   *     expect(subtractTwo).to.decrease(getVal); // Not recommended
   *
   * When two arguments are provided, `.decrease` asserts that the value of the
   * given object `subject`'s `prop` property is lesser after invoking the
   * target function compared to beforehand.
   *
   *     var myObj = {val: 1}
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.decrease(myObj, 'val'); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.decrease`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the subject either increases, or that it stays the same.
   * It's often best to identify the exact output that's expected, and then
   * write an assertion that only accepts that exact output.
   *
   * When the subject is expected to increase, it's often best to assert that it
   * increased by the expected amount.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.not.decrease(myObj, 'val'); // Not recommended
   *
   * When the subject is expected to stay the same, it's often best to assert
   * exactly that.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.not.change(myObj, 'val'); // Recommended
   *     expect(noop).to.not.decrease(myObj, 'val'); // Not recommended
   *
   * `.decrease` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing two arguments, always
   * use the second form.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.decrease(myObj, 'val', 'nooo why fail??');
   *
   *     var val = 1
   *       , noop = function () {}
   *       , getVal = function () { return val; };
   *
   *     expect(noop, 'nooo why fail??').to.decrease(getVal);
   *
   * The alias `.decreases` can be used interchangeably with `.decrease`.
   *
   * @name decrease
   * @alias decreases
   * @param {String|Function} subject
   * @param {String} prop name _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertDecreases (subject, prop, msg) {
    if (msg) flag(this, 'message', msg);
    var fn = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(fn, flagMsg, ssfi, true).is.a('function');

    var initial;
    if (!prop) {
      new Assertion(subject, flagMsg, ssfi, true).is.a('function');
      initial = subject();
    } else {
      new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
      initial = subject[prop];
    }

    // Make sure that the target is a number
    new Assertion(initial, flagMsg, ssfi, true).is.a('number');

    fn();

    var final = prop === undefined || prop === null ? subject() : subject[prop];
    var msgObj = prop === undefined || prop === null ? initial : '.' + prop;

    flag(this, 'deltaMsgObj', msgObj);
    flag(this, 'initialDeltaValue', initial);
    flag(this, 'finalDeltaValue', final);
    flag(this, 'deltaBehavior', 'decrease');
    flag(this, 'realDelta', initial - final);

    this.assert(
      final - initial < 0
      , 'expected ' + msgObj + ' to decrease'
      , 'expected ' + msgObj + ' to not decrease'
    );
  }

  Assertion.addMethod('decrease', assertDecreases);
  Assertion.addMethod('decreases', assertDecreases);

  /**
   * ### .by(delta[, msg])
   *
   * When following an `.increase` assertion in the chain, `.by` asserts that
   * the subject of the `.increase` assertion increased by the given `delta`.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2);
   *
   * When following a `.decrease` assertion in the chain, `.by` asserts that the
   * subject of the `.decrease` assertion decreased by the given `delta`.
   *
   *     var myObj = {val: 1}
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2);
   *
   * When following a `.change` assertion in the chain, `.by` asserts that the
   * subject of the `.change` assertion either increased or decreased by the
   * given `delta`. However, it's dangerous to use `.change.by`. The problem is
   * that it creates uncertain expectations. It's often best to identify the
   * exact output that's expected, and then write an assertion that only accepts
   * that exact output.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; }
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.by`. However, it's often best
   * to assert that the subject changed by its expected delta, rather than
   * asserting that it didn't change by one of countless unexpected deltas.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     // Recommended
   *     expect(addTwo).to.increase(myObj, 'val').by(2);
   *
   *     // Not recommended
   *     expect(addTwo).to.increase(myObj, 'val').but.not.by(3);
   *
   * `.by` accepts an optional `msg` argument which is a custom error message to
   * show when the assertion fails. The message can also be given as the second
   * argument to `expect`.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(3, 'nooo why fail??');
   *     expect(addTwo, 'nooo why fail??').to.increase(myObj, 'val').by(3);
   *
   * @name by
   * @param {Number} delta
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertDelta(delta, msg) {
    if (msg) flag(this, 'message', msg);

    var msgObj = flag(this, 'deltaMsgObj');
    var initial = flag(this, 'initialDeltaValue');
    var final = flag(this, 'finalDeltaValue');
    var behavior = flag(this, 'deltaBehavior');
    var realDelta = flag(this, 'realDelta');

    var expression;
    if (behavior === 'change') {
      expression = Math.abs(final - initial) === Math.abs(delta);
    } else {
      expression = realDelta === Math.abs(delta);
    }

    this.assert(
      expression
      , 'expected ' + msgObj + ' to ' + behavior + ' by ' + delta
      , 'expected ' + msgObj + ' to not ' + behavior + ' by ' + delta
    );
  }

  Assertion.addMethod('by', assertDelta);

  /**
   * ### .extensible
   *
   * Asserts that the target is extensible, which means that new properties can
   * be added to it. Primitives are never extensible.
   *
   *     expect({a: 1}).to.be.extensible;
   *
   * Add `.not` earlier in the chain to negate `.extensible`.
   *
   *     var nonExtensibleObject = Object.preventExtensions({})
   *       , sealedObject = Object.seal({})
   *       , frozenObject = Object.freeze({});
   *
   *     expect(nonExtensibleObject).to.not.be.extensible;
   *     expect(sealedObject).to.not.be.extensible;
   *     expect(frozenObject).to.not.be.extensible;
   *     expect(1).to.not.be.extensible;
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(1, 'nooo why fail??').to.be.extensible;
   *
   * @name extensible
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('extensible', function() {
    var obj = flag(this, 'object');

    // In ES5, if the argument to this method is a primitive, then it will cause a TypeError.
    // In ES6, a non-object argument will be treated as if it was a non-extensible ordinary object, simply return false.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible
    // The following provides ES6 behavior for ES5 environments.

    var isExtensible = obj === Object(obj) && Object.isExtensible(obj);

    this.assert(
      isExtensible
      , 'expected #{this} to be extensible'
      , 'expected #{this} to not be extensible'
    );
  });

  /**
   * ### .sealed
   *
   * Asserts that the target is sealed, which means that new properties can't be
   * added to it, and its existing properties can't be reconfigured or deleted.
   * However, it's possible that its existing properties can still be reassigned
   * to different values. Primitives are always sealed.
   *
   *     var sealedObject = Object.seal({});
   *     var frozenObject = Object.freeze({});
   *
   *     expect(sealedObject).to.be.sealed;
   *     expect(frozenObject).to.be.sealed;
   *     expect(1).to.be.sealed;
   *
   * Add `.not` earlier in the chain to negate `.sealed`.
   *
   *     expect({a: 1}).to.not.be.sealed;
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({a: 1}, 'nooo why fail??').to.be.sealed;
   *
   * @name sealed
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('sealed', function() {
    var obj = flag(this, 'object');

    // In ES5, if the argument to this method is a primitive, then it will cause a TypeError.
    // In ES6, a non-object argument will be treated as if it was a sealed ordinary object, simply return true.
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isSealed
    // The following provides ES6 behavior for ES5 environments.

    var isSealed = obj === Object(obj) ? Object.isSealed(obj) : true;

    this.assert(
      isSealed
      , 'expected #{this} to be sealed'
      , 'expected #{this} to not be sealed'
    );
  });

  /**
   * ### .frozen
   *
   * Asserts that the target is frozen, which means that new properties can't be
   * added to it, and its existing properties can't be reassigned to different
   * values, reconfigured, or deleted. Primitives are always frozen.
   *
   *     var frozenObject = Object.freeze({});
   *
   *     expect(frozenObject).to.be.frozen;
   *     expect(1).to.be.frozen;
   *
   * Add `.not` earlier in the chain to negate `.frozen`.
   *
   *     expect({a: 1}).to.not.be.frozen;
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({a: 1}, 'nooo why fail??').to.be.frozen;
   *
   * @name frozen
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('frozen', function() {
    var obj = flag(this, 'object');

    // In ES5, if the argument to this method is a primitive, then it will cause a TypeError.
    // In ES6, a non-object argument will be treated as if it was a frozen ordinary object, simply return true.
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isFrozen
    // The following provides ES6 behavior for ES5 environments.

    var isFrozen = obj === Object(obj) ? Object.isFrozen(obj) : true;

    this.assert(
      isFrozen
      , 'expected #{this} to be frozen'
      , 'expected #{this} to not be frozen'
    );
  });

  /**
   * ### .finite
   *
   * Asserts that the target is a number, and isn't `NaN` or positive/negative
   * `Infinity`.
   *
   *     expect(1).to.be.finite;
   *
   * Add `.not` earlier in the chain to negate `.finite`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the subject either isn't a number, or that it's `NaN`, or
   * that it's positive `Infinity`, or that it's negative `Infinity`. It's often
   * best to identify the exact output that's expected, and then write an
   * assertion that only accepts that exact output.
   *
   * When the target isn't expected to be a number, it's often best to assert
   * that it's the expected type, rather than asserting that it isn't one of
   * many unexpected types.
   *
   *     expect('foo').to.be.a('string'); // Recommended
   *     expect('foo').to.not.be.finite; // Not recommended
   *
   * When the target is expected to be `NaN`, it's often best to assert exactly
   * that.
   *
   *     expect(NaN).to.be.NaN; // Recommended
   *     expect(NaN).to.not.be.finite; // Not recommended
   *
   * When the target is expected to be positive infinity, it's often best to
   * assert exactly that.
   *
   *     expect(Infinity).to.equal(Infinity); // Recommended
   *     expect(Infinity).to.not.be.finite; // Not recommended
   *
   * When the target is expected to be negative infinity, it's often best to
   * assert exactly that.
   *
   *     expect(-Infinity).to.equal(-Infinity); // Recommended
   *     expect(-Infinity).to.not.be.finite; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect('foo', 'nooo why fail??').to.be.finite;
   *
   * @name finite
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('finite', function(msg) {
    var obj = flag(this, 'object');

    this.assert(
        typeof obj === 'number' && isFinite(obj)
      , 'expected #{this} to be a finite number'
      , 'expected #{this} to not be a finite number'
    );
  });
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/interface/assert.js":
/***/ ((module) => {

/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  /*!
   * Chai dependencies.
   */

  var Assertion = chai.Assertion
    , flag = util.flag;

  /*!
   * Module export.
   */

  /**
   * ### assert(expression, message)
   *
   * Write your own test expressions.
   *
   *     assert('foo' !== 'bar', 'foo is not bar');
   *     assert(Array.isArray([]), 'empty arrays are arrays');
   *
   * @param {Mixed} expression to test for truthiness
   * @param {String} message to display on error
   * @name assert
   * @namespace Assert
   * @api public
   */

  var assert = chai.assert = function (express, errmsg) {
    var test = new Assertion(null, null, chai.assert, true);
    test.assert(
        express
      , errmsg
      , '[ negation message unavailable ]'
    );
  };

  /**
   * ### .fail([message])
   * ### .fail(actual, expected, [message], [operator])
   *
   * Throw a failure. Node.js `assert` module-compatible.
   *
   *     assert.fail();
   *     assert.fail("custom error message");
   *     assert.fail(1, 2);
   *     assert.fail(1, 2, "custom error message");
   *     assert.fail(1, 2, "custom error message", ">");
   *     assert.fail(1, 2, undefined, ">");
   *
   * @name fail
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @param {String} operator
   * @namespace Assert
   * @api public
   */

  assert.fail = function (actual, expected, message, operator) {
    if (arguments.length < 2) {
        // Comply with Node's fail([message]) interface

        message = actual;
        actual = undefined;
    }

    message = message || 'assert.fail()';
    throw new chai.AssertionError(message, {
        actual: actual
      , expected: expected
      , operator: operator
    }, assert.fail);
  };

  /**
   * ### .isOk(object, [message])
   *
   * Asserts that `object` is truthy.
   *
   *     assert.isOk('everything', 'everything is ok');
   *     assert.isOk(false, 'this will fail');
   *
   * @name isOk
   * @alias ok
   * @param {Mixed} object to test
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isOk = function (val, msg) {
    new Assertion(val, msg, assert.isOk, true).is.ok;
  };

  /**
   * ### .isNotOk(object, [message])
   *
   * Asserts that `object` is falsy.
   *
   *     assert.isNotOk('everything', 'this will fail');
   *     assert.isNotOk(false, 'this will pass');
   *
   * @name isNotOk
   * @alias notOk
   * @param {Mixed} object to test
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotOk = function (val, msg) {
    new Assertion(val, msg, assert.isNotOk, true).is.not.ok;
  };

  /**
   * ### .equal(actual, expected, [message])
   *
   * Asserts non-strict equality (`==`) of `actual` and `expected`.
   *
   *     assert.equal(3, '3', '== coerces values to strings');
   *
   * @name equal
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.equal = function (act, exp, msg) {
    var test = new Assertion(act, msg, assert.equal, true);

    test.assert(
        exp == flag(test, 'object')
      , 'expected #{this} to equal #{exp}'
      , 'expected #{this} to not equal #{act}'
      , exp
      , act
      , true
    );
  };

  /**
   * ### .notEqual(actual, expected, [message])
   *
   * Asserts non-strict inequality (`!=`) of `actual` and `expected`.
   *
   *     assert.notEqual(3, 4, 'these numbers are not equal');
   *
   * @name notEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notEqual = function (act, exp, msg) {
    var test = new Assertion(act, msg, assert.notEqual, true);

    test.assert(
        exp != flag(test, 'object')
      , 'expected #{this} to not equal #{exp}'
      , 'expected #{this} to equal #{act}'
      , exp
      , act
      , true
    );
  };

  /**
   * ### .strictEqual(actual, expected, [message])
   *
   * Asserts strict equality (`===`) of `actual` and `expected`.
   *
   *     assert.strictEqual(true, true, 'these booleans are strictly equal');
   *
   * @name strictEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.strictEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.strictEqual, true).to.equal(exp);
  };

  /**
   * ### .notStrictEqual(actual, expected, [message])
   *
   * Asserts strict inequality (`!==`) of `actual` and `expected`.
   *
   *     assert.notStrictEqual(3, '3', 'no coercion for strict equality');
   *
   * @name notStrictEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notStrictEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.notStrictEqual, true).to.not.equal(exp);
  };

  /**
   * ### .deepEqual(actual, expected, [message])
   *
   * Asserts that `actual` is deeply equal to `expected`.
   *
   *     assert.deepEqual({ tea: 'green' }, { tea: 'green' });
   *
   * @name deepEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @alias deepStrictEqual
   * @namespace Assert
   * @api public
   */

  assert.deepEqual = assert.deepStrictEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.deepEqual, true).to.eql(exp);
  };

  /**
   * ### .notDeepEqual(actual, expected, [message])
   *
   * Assert that `actual` is not deeply equal to `expected`.
   *
   *     assert.notDeepEqual({ tea: 'green' }, { tea: 'jasmine' });
   *
   * @name notDeepEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.notDeepEqual, true).to.not.eql(exp);
  };

   /**
   * ### .isAbove(valueToCheck, valueToBeAbove, [message])
   *
   * Asserts `valueToCheck` is strictly greater than (>) `valueToBeAbove`.
   *
   *     assert.isAbove(5, 2, '5 is strictly greater than 2');
   *
   * @name isAbove
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeAbove
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isAbove = function (val, abv, msg) {
    new Assertion(val, msg, assert.isAbove, true).to.be.above(abv);
  };

   /**
   * ### .isAtLeast(valueToCheck, valueToBeAtLeast, [message])
   *
   * Asserts `valueToCheck` is greater than or equal to (>=) `valueToBeAtLeast`.
   *
   *     assert.isAtLeast(5, 2, '5 is greater or equal to 2');
   *     assert.isAtLeast(3, 3, '3 is greater or equal to 3');
   *
   * @name isAtLeast
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeAtLeast
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isAtLeast = function (val, atlst, msg) {
    new Assertion(val, msg, assert.isAtLeast, true).to.be.least(atlst);
  };

   /**
   * ### .isBelow(valueToCheck, valueToBeBelow, [message])
   *
   * Asserts `valueToCheck` is strictly less than (<) `valueToBeBelow`.
   *
   *     assert.isBelow(3, 6, '3 is strictly less than 6');
   *
   * @name isBelow
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeBelow
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isBelow = function (val, blw, msg) {
    new Assertion(val, msg, assert.isBelow, true).to.be.below(blw);
  };

   /**
   * ### .isAtMost(valueToCheck, valueToBeAtMost, [message])
   *
   * Asserts `valueToCheck` is less than or equal to (<=) `valueToBeAtMost`.
   *
   *     assert.isAtMost(3, 6, '3 is less than or equal to 6');
   *     assert.isAtMost(4, 4, '4 is less than or equal to 4');
   *
   * @name isAtMost
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeAtMost
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isAtMost = function (val, atmst, msg) {
    new Assertion(val, msg, assert.isAtMost, true).to.be.most(atmst);
  };

  /**
   * ### .isTrue(value, [message])
   *
   * Asserts that `value` is true.
   *
   *     var teaServed = true;
   *     assert.isTrue(teaServed, 'the tea has been served');
   *
   * @name isTrue
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isTrue = function (val, msg) {
    new Assertion(val, msg, assert.isTrue, true).is['true'];
  };

  /**
   * ### .isNotTrue(value, [message])
   *
   * Asserts that `value` is not true.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotTrue(tea, 'great, time for tea!');
   *
   * @name isNotTrue
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotTrue = function (val, msg) {
    new Assertion(val, msg, assert.isNotTrue, true).to.not.equal(true);
  };

  /**
   * ### .isFalse(value, [message])
   *
   * Asserts that `value` is false.
   *
   *     var teaServed = false;
   *     assert.isFalse(teaServed, 'no tea yet? hmm...');
   *
   * @name isFalse
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isFalse = function (val, msg) {
    new Assertion(val, msg, assert.isFalse, true).is['false'];
  };

  /**
   * ### .isNotFalse(value, [message])
   *
   * Asserts that `value` is not false.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotFalse(tea, 'great, time for tea!');
   *
   * @name isNotFalse
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotFalse = function (val, msg) {
    new Assertion(val, msg, assert.isNotFalse, true).to.not.equal(false);
  };

  /**
   * ### .isNull(value, [message])
   *
   * Asserts that `value` is null.
   *
   *     assert.isNull(err, 'there was no error');
   *
   * @name isNull
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNull = function (val, msg) {
    new Assertion(val, msg, assert.isNull, true).to.equal(null);
  };

  /**
   * ### .isNotNull(value, [message])
   *
   * Asserts that `value` is not null.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotNull(tea, 'great, time for tea!');
   *
   * @name isNotNull
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotNull = function (val, msg) {
    new Assertion(val, msg, assert.isNotNull, true).to.not.equal(null);
  };

  /**
   * ### .isNaN
   *
   * Asserts that value is NaN.
   *
   *     assert.isNaN(NaN, 'NaN is NaN');
   *
   * @name isNaN
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNaN = function (val, msg) {
    new Assertion(val, msg, assert.isNaN, true).to.be.NaN;
  };

  /**
   * ### .isNotNaN
   *
   * Asserts that value is not NaN.
   *
   *     assert.isNotNaN(4, '4 is not NaN');
   *
   * @name isNotNaN
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */
  assert.isNotNaN = function (val, msg) {
    new Assertion(val, msg, assert.isNotNaN, true).not.to.be.NaN;
  };

  /**
   * ### .exists
   *
   * Asserts that the target is neither `null` nor `undefined`.
   *
   *     var foo = 'hi';
   *
   *     assert.exists(foo, 'foo is neither `null` nor `undefined`');
   *
   * @name exists
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.exists = function (val, msg) {
    new Assertion(val, msg, assert.exists, true).to.exist;
  };

  /**
   * ### .notExists
   *
   * Asserts that the target is either `null` or `undefined`.
   *
   *     var bar = null
   *       , baz;
   *
   *     assert.notExists(bar);
   *     assert.notExists(baz, 'baz is either null or undefined');
   *
   * @name notExists
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notExists = function (val, msg) {
    new Assertion(val, msg, assert.notExists, true).to.not.exist;
  };

  /**
   * ### .isUndefined(value, [message])
   *
   * Asserts that `value` is `undefined`.
   *
   *     var tea;
   *     assert.isUndefined(tea, 'no tea defined');
   *
   * @name isUndefined
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isUndefined = function (val, msg) {
    new Assertion(val, msg, assert.isUndefined, true).to.equal(undefined);
  };

  /**
   * ### .isDefined(value, [message])
   *
   * Asserts that `value` is not `undefined`.
   *
   *     var tea = 'cup of chai';
   *     assert.isDefined(tea, 'tea has been defined');
   *
   * @name isDefined
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isDefined = function (val, msg) {
    new Assertion(val, msg, assert.isDefined, true).to.not.equal(undefined);
  };

  /**
   * ### .isFunction(value, [message])
   *
   * Asserts that `value` is a function.
   *
   *     function serveTea() { return 'cup of tea'; };
   *     assert.isFunction(serveTea, 'great, we can have tea now');
   *
   * @name isFunction
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isFunction = function (val, msg) {
    new Assertion(val, msg, assert.isFunction, true).to.be.a('function');
  };

  /**
   * ### .isNotFunction(value, [message])
   *
   * Asserts that `value` is _not_ a function.
   *
   *     var serveTea = [ 'heat', 'pour', 'sip' ];
   *     assert.isNotFunction(serveTea, 'great, we have listed the steps');
   *
   * @name isNotFunction
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotFunction = function (val, msg) {
    new Assertion(val, msg, assert.isNotFunction, true).to.not.be.a('function');
  };

  /**
   * ### .isObject(value, [message])
   *
   * Asserts that `value` is an object of type 'Object' (as revealed by `Object.prototype.toString`).
   * _The assertion does not match subclassed objects._
   *
   *     var selection = { name: 'Chai', serve: 'with spices' };
   *     assert.isObject(selection, 'tea selection is an object');
   *
   * @name isObject
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isObject = function (val, msg) {
    new Assertion(val, msg, assert.isObject, true).to.be.a('object');
  };

  /**
   * ### .isNotObject(value, [message])
   *
   * Asserts that `value` is _not_ an object of type 'Object' (as revealed by `Object.prototype.toString`).
   *
   *     var selection = 'chai'
   *     assert.isNotObject(selection, 'tea selection is not an object');
   *     assert.isNotObject(null, 'null is not an object');
   *
   * @name isNotObject
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotObject = function (val, msg) {
    new Assertion(val, msg, assert.isNotObject, true).to.not.be.a('object');
  };

  /**
   * ### .isArray(value, [message])
   *
   * Asserts that `value` is an array.
   *
   *     var menu = [ 'green', 'chai', 'oolong' ];
   *     assert.isArray(menu, 'what kind of tea do we want?');
   *
   * @name isArray
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isArray = function (val, msg) {
    new Assertion(val, msg, assert.isArray, true).to.be.an('array');
  };

  /**
   * ### .isNotArray(value, [message])
   *
   * Asserts that `value` is _not_ an array.
   *
   *     var menu = 'green|chai|oolong';
   *     assert.isNotArray(menu, 'what kind of tea do we want?');
   *
   * @name isNotArray
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotArray = function (val, msg) {
    new Assertion(val, msg, assert.isNotArray, true).to.not.be.an('array');
  };

  /**
   * ### .isString(value, [message])
   *
   * Asserts that `value` is a string.
   *
   *     var teaOrder = 'chai';
   *     assert.isString(teaOrder, 'order placed');
   *
   * @name isString
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isString = function (val, msg) {
    new Assertion(val, msg, assert.isString, true).to.be.a('string');
  };

  /**
   * ### .isNotString(value, [message])
   *
   * Asserts that `value` is _not_ a string.
   *
   *     var teaOrder = 4;
   *     assert.isNotString(teaOrder, 'order placed');
   *
   * @name isNotString
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotString = function (val, msg) {
    new Assertion(val, msg, assert.isNotString, true).to.not.be.a('string');
  };

  /**
   * ### .isNumber(value, [message])
   *
   * Asserts that `value` is a number.
   *
   *     var cups = 2;
   *     assert.isNumber(cups, 'how many cups');
   *
   * @name isNumber
   * @param {Number} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNumber = function (val, msg) {
    new Assertion(val, msg, assert.isNumber, true).to.be.a('number');
  };

  /**
   * ### .isNotNumber(value, [message])
   *
   * Asserts that `value` is _not_ a number.
   *
   *     var cups = '2 cups please';
   *     assert.isNotNumber(cups, 'how many cups');
   *
   * @name isNotNumber
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotNumber = function (val, msg) {
    new Assertion(val, msg, assert.isNotNumber, true).to.not.be.a('number');
  };

   /**
   * ### .isFinite(value, [message])
   *
   * Asserts that `value` is a finite number. Unlike `.isNumber`, this will fail for `NaN` and `Infinity`.
   *
   *     var cups = 2;
   *     assert.isFinite(cups, 'how many cups');
   *
   *     assert.isFinite(NaN); // throws
   *
   * @name isFinite
   * @param {Number} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isFinite = function (val, msg) {
    new Assertion(val, msg, assert.isFinite, true).to.be.finite;
  };

  /**
   * ### .isBoolean(value, [message])
   *
   * Asserts that `value` is a boolean.
   *
   *     var teaReady = true
   *       , teaServed = false;
   *
   *     assert.isBoolean(teaReady, 'is the tea ready');
   *     assert.isBoolean(teaServed, 'has tea been served');
   *
   * @name isBoolean
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isBoolean = function (val, msg) {
    new Assertion(val, msg, assert.isBoolean, true).to.be.a('boolean');
  };

  /**
   * ### .isNotBoolean(value, [message])
   *
   * Asserts that `value` is _not_ a boolean.
   *
   *     var teaReady = 'yep'
   *       , teaServed = 'nope';
   *
   *     assert.isNotBoolean(teaReady, 'is the tea ready');
   *     assert.isNotBoolean(teaServed, 'has tea been served');
   *
   * @name isNotBoolean
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotBoolean = function (val, msg) {
    new Assertion(val, msg, assert.isNotBoolean, true).to.not.be.a('boolean');
  };

  /**
   * ### .typeOf(value, name, [message])
   *
   * Asserts that `value`'s type is `name`, as determined by
   * `Object.prototype.toString`.
   *
   *     assert.typeOf({ tea: 'chai' }, 'object', 'we have an object');
   *     assert.typeOf(['chai', 'jasmine'], 'array', 'we have an array');
   *     assert.typeOf('tea', 'string', 'we have a string');
   *     assert.typeOf(/tea/, 'regexp', 'we have a regular expression');
   *     assert.typeOf(null, 'null', 'we have a null');
   *     assert.typeOf(undefined, 'undefined', 'we have an undefined');
   *
   * @name typeOf
   * @param {Mixed} value
   * @param {String} name
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.typeOf = function (val, type, msg) {
    new Assertion(val, msg, assert.typeOf, true).to.be.a(type);
  };

  /**
   * ### .notTypeOf(value, name, [message])
   *
   * Asserts that `value`'s type is _not_ `name`, as determined by
   * `Object.prototype.toString`.
   *
   *     assert.notTypeOf('tea', 'number', 'strings are not numbers');
   *
   * @name notTypeOf
   * @param {Mixed} value
   * @param {String} typeof name
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notTypeOf = function (val, type, msg) {
    new Assertion(val, msg, assert.notTypeOf, true).to.not.be.a(type);
  };

  /**
   * ### .instanceOf(object, constructor, [message])
   *
   * Asserts that `value` is an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , chai = new Tea('chai');
   *
   *     assert.instanceOf(chai, Tea, 'chai is an instance of tea');
   *
   * @name instanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.instanceOf = function (val, type, msg) {
    new Assertion(val, msg, assert.instanceOf, true).to.be.instanceOf(type);
  };

  /**
   * ### .notInstanceOf(object, constructor, [message])
   *
   * Asserts `value` is not an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , chai = new String('chai');
   *
   *     assert.notInstanceOf(chai, Tea, 'chai is not an instance of tea');
   *
   * @name notInstanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notInstanceOf = function (val, type, msg) {
    new Assertion(val, msg, assert.notInstanceOf, true)
      .to.not.be.instanceOf(type);
  };

  /**
   * ### .include(haystack, needle, [message])
   *
   * Asserts that `haystack` includes `needle`. Can be used to assert the
   * inclusion of a value in an array, a substring in a string, or a subset of
   * properties in an object.
   *
   *     assert.include([1,2,3], 2, 'array contains value');
   *     assert.include('foobar', 'foo', 'string contains substring');
   *     assert.include({ foo: 'bar', hello: 'universe' }, { foo: 'bar' }, 'object contains property');
   *
   * Strict equality (===) is used. When asserting the inclusion of a value in
   * an array, the array is searched for an element that's strictly equal to the
   * given value. When asserting a subset of properties in an object, the object
   * is searched for the given property keys, checking that each one is present
   * and strictly equal to the given property value. For instance:
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.include([obj1, obj2], obj1);
   *     assert.include({foo: obj1, bar: obj2}, {foo: obj1});
   *     assert.include({foo: obj1, bar: obj2}, {foo: obj1, bar: obj2});
   *
   * @name include
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.include = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.include, true).include(inc);
  };

  /**
   * ### .notInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` does not include `needle`. Can be used to assert
   * the absence of a value in an array, a substring in a string, or a subset of
   * properties in an object.
   *
   *     assert.notInclude([1,2,3], 4, "array doesn't contain value");
   *     assert.notInclude('foobar', 'baz', "string doesn't contain substring");
   *     assert.notInclude({ foo: 'bar', hello: 'universe' }, { foo: 'baz' }, 'object doesn't contain property');
   *
   * Strict equality (===) is used. When asserting the absence of a value in an
   * array, the array is searched to confirm the absence of an element that's
   * strictly equal to the given value. When asserting a subset of properties in
   * an object, the object is searched to confirm that at least one of the given
   * property keys is either not present or not strictly equal to the given
   * property value. For instance:
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.notInclude([obj1, obj2], {a: 1});
   *     assert.notInclude({foo: obj1, bar: obj2}, {foo: {a: 1}});
   *     assert.notInclude({foo: obj1, bar: obj2}, {foo: obj1, bar: {b: 2}});
   *
   * @name notInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notInclude, true).not.include(inc);
  };

  /**
   * ### .deepInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` includes `needle`. Can be used to assert the
   * inclusion of a value in an array or a subset of properties in an object.
   * Deep equality is used.
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.deepInclude([obj1, obj2], {a: 1});
   *     assert.deepInclude({foo: obj1, bar: obj2}, {foo: {a: 1}});
   *     assert.deepInclude({foo: obj1, bar: obj2}, {foo: {a: 1}, bar: {b: 2}});
   *
   * @name deepInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.deepInclude, true).deep.include(inc);
  };

  /**
   * ### .notDeepInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` does not include `needle`. Can be used to assert
   * the absence of a value in an array or a subset of properties in an object.
   * Deep equality is used.
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.notDeepInclude([obj1, obj2], {a: 9});
   *     assert.notDeepInclude({foo: obj1, bar: obj2}, {foo: {a: 9}});
   *     assert.notDeepInclude({foo: obj1, bar: obj2}, {foo: {a: 1}, bar: {b: 9}});
   *
   * @name notDeepInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notDeepInclude, true).not.deep.include(inc);
  };

  /**
   * ### .nestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.nestedInclude({'.a': {'b': 'x'}}, {'\\.a.[b]': 'x'});
   *     assert.nestedInclude({'a': {'[b]': 'x'}}, {'a.\\[b\\]': 'x'});
   *
   * @name nestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.nestedInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.nestedInclude, true).nested.include(inc);
  };

  /**
   * ### .notNestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' does not include 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.notNestedInclude({'.a': {'b': 'x'}}, {'\\.a.b': 'y'});
   *     assert.notNestedInclude({'a': {'[b]': 'x'}}, {'a.\\[b\\]': 'y'});
   *
   * @name notNestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notNestedInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notNestedInclude, true)
      .not.nested.include(inc);
  };

  /**
   * ### .deepNestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object while checking for deep equality.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.deepNestedInclude({a: {b: [{x: 1}]}}, {'a.b[0]': {x: 1}});
   *     assert.deepNestedInclude({'.a': {'[b]': {x: 1}}}, {'\\.a.\\[b\\]': {x: 1}});
   *
   * @name deepNestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepNestedInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.deepNestedInclude, true)
      .deep.nested.include(inc);
  };

  /**
   * ### .notDeepNestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' does not include 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object while checking for deep equality.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.notDeepNestedInclude({a: {b: [{x: 1}]}}, {'a.b[0]': {y: 1}})
   *     assert.notDeepNestedInclude({'.a': {'[b]': {x: 1}}}, {'\\.a.\\[b\\]': {y: 2}});
   *
   * @name notDeepNestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepNestedInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.notDeepNestedInclude, true)
      .not.deep.nested.include(inc);
  };

  /**
   * ### .ownInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object while ignoring inherited properties.
   *
   *     assert.ownInclude({ a: 1 }, { a: 1 });
   *
   * @name ownInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.ownInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.ownInclude, true).own.include(inc);
  };

  /**
   * ### .notOwnInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object while ignoring inherited properties.
   *
   *     Object.prototype.b = 2;
   *
   *     assert.notOwnInclude({ a: 1 }, { b: 2 });
   *
   * @name notOwnInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notOwnInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.notOwnInclude, true).not.own.include(inc);
  };

  /**
   * ### .deepOwnInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object while ignoring inherited properties and checking for deep equality.
   *
   *      assert.deepOwnInclude({a: {b: 2}}, {a: {b: 2}});
   *
   * @name deepOwnInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepOwnInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.deepOwnInclude, true)
      .deep.own.include(inc);
  };

   /**
   * ### .notDeepOwnInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object while ignoring inherited properties and checking for deep equality.
   *
   *      assert.notDeepOwnInclude({a: {b: 2}}, {a: {c: 3}});
   *
   * @name notDeepOwnInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepOwnInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.notDeepOwnInclude, true)
      .not.deep.own.include(inc);
  };

  /**
   * ### .match(value, regexp, [message])
   *
   * Asserts that `value` matches the regular expression `regexp`.
   *
   *     assert.match('foobar', /^foo/, 'regexp matches');
   *
   * @name match
   * @param {Mixed} value
   * @param {RegExp} regexp
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.match = function (exp, re, msg) {
    new Assertion(exp, msg, assert.match, true).to.match(re);
  };

  /**
   * ### .notMatch(value, regexp, [message])
   *
   * Asserts that `value` does not match the regular expression `regexp`.
   *
   *     assert.notMatch('foobar', /^foo/, 'regexp does not match');
   *
   * @name notMatch
   * @param {Mixed} value
   * @param {RegExp} regexp
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notMatch = function (exp, re, msg) {
    new Assertion(exp, msg, assert.notMatch, true).to.not.match(re);
  };

  /**
   * ### .property(object, property, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property`.
   *
   *     assert.property({ tea: { green: 'matcha' }}, 'tea');
   *     assert.property({ tea: { green: 'matcha' }}, 'toString');
   *
   * @name property
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.property = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.property, true).to.have.property(prop);
  };

  /**
   * ### .notProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a direct or inherited property named
   * by `property`.
   *
   *     assert.notProperty({ tea: { green: 'matcha' }}, 'coffee');
   *
   * @name notProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.notProperty, true)
      .to.not.have.property(prop);
  };

  /**
   * ### .propertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property` with a value given by `value`. Uses a strict equality check
   * (===).
   *
   *     assert.propertyVal({ tea: 'is good' }, 'tea', 'is good');
   *
   * @name propertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.propertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.propertyVal, true)
      .to.have.property(prop, val);
  };

  /**
   * ### .notPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct or inherited property named
   * by `property` with value given by `value`. Uses a strict equality check
   * (===).
   *
   *     assert.notPropertyVal({ tea: 'is good' }, 'tea', 'is bad');
   *     assert.notPropertyVal({ tea: 'is good' }, 'coffee', 'is good');
   *
   * @name notPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notPropertyVal, true)
      .to.not.have.property(prop, val);
  };

  /**
   * ### .deepPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property` with a value given by `value`. Uses a deep equality check.
   *
   *     assert.deepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' });
   *
   * @name deepPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.deepPropertyVal, true)
      .to.have.deep.property(prop, val);
  };

  /**
   * ### .notDeepPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct or inherited property named
   * by `property` with value given by `value`. Uses a deep equality check.
   *
   *     assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' });
   *     assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' });
   *     assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' });
   *
   * @name notDeepPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notDeepPropertyVal, true)
      .to.not.have.deep.property(prop, val);
  };

  /**
   * ### .ownProperty(object, property, [message])
   *
   * Asserts that `object` has a direct property named by `property`. Inherited
   * properties aren't checked.
   *
   *     assert.ownProperty({ tea: { green: 'matcha' }}, 'tea');
   *
   * @name ownProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.ownProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.ownProperty, true)
      .to.have.own.property(prop);
  };

  /**
   * ### .notOwnProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a direct property named by
   * `property`. Inherited properties aren't checked.
   *
   *     assert.notOwnProperty({ tea: { green: 'matcha' }}, 'coffee');
   *     assert.notOwnProperty({}, 'toString');
   *
   * @name notOwnProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.notOwnProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.notOwnProperty, true)
      .to.not.have.own.property(prop);
  };

  /**
   * ### .ownPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct property named by `property` and a value
   * equal to the provided `value`. Uses a strict equality check (===).
   * Inherited properties aren't checked.
   *
   *     assert.ownPropertyVal({ coffee: 'is good'}, 'coffee', 'is good');
   *
   * @name ownPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.ownPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.ownPropertyVal, true)
      .to.have.own.property(prop, value);
  };

  /**
   * ### .notOwnPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct property named by `property`
   * with a value equal to the provided `value`. Uses a strict equality check
   * (===). Inherited properties aren't checked.
   *
   *     assert.notOwnPropertyVal({ tea: 'is better'}, 'tea', 'is worse');
   *     assert.notOwnPropertyVal({}, 'toString', Object.prototype.toString);
   *
   * @name notOwnPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.notOwnPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.notOwnPropertyVal, true)
      .to.not.have.own.property(prop, value);
  };

  /**
   * ### .deepOwnPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct property named by `property` and a value
   * equal to the provided `value`. Uses a deep equality check. Inherited
   * properties aren't checked.
   *
   *     assert.deepOwnPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' });
   *
   * @name deepOwnPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.deepOwnPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.deepOwnPropertyVal, true)
      .to.have.deep.own.property(prop, value);
  };

  /**
   * ### .notDeepOwnPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct property named by `property`
   * with a value equal to the provided `value`. Uses a deep equality check.
   * Inherited properties aren't checked.
   *
   *     assert.notDeepOwnPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' });
   *     assert.notDeepOwnPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' });
   *     assert.notDeepOwnPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' });
   *     assert.notDeepOwnPropertyVal({}, 'toString', Object.prototype.toString);
   *
   * @name notDeepOwnPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.notDeepOwnPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.notDeepOwnPropertyVal, true)
      .to.not.have.deep.own.property(prop, value);
  };

  /**
   * ### .nestedProperty(object, property, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property`, which can be a string using dot- and bracket-notation for
   * nested reference.
   *
   *     assert.nestedProperty({ tea: { green: 'matcha' }}, 'tea.green');
   *
   * @name nestedProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.nestedProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.nestedProperty, true)
      .to.have.nested.property(prop);
  };

  /**
   * ### .notNestedProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property`, which
   * can be a string using dot- and bracket-notation for nested reference. The
   * property cannot exist on the object nor anywhere in its prototype chain.
   *
   *     assert.notNestedProperty({ tea: { green: 'matcha' }}, 'tea.oolong');
   *
   * @name notNestedProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notNestedProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.notNestedProperty, true)
      .to.not.have.nested.property(prop);
  };

  /**
   * ### .nestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property` with value given
   * by `value`. `property` can use dot- and bracket-notation for nested
   * reference. Uses a strict equality check (===).
   *
   *     assert.nestedPropertyVal({ tea: { green: 'matcha' }}, 'tea.green', 'matcha');
   *
   * @name nestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.nestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.nestedPropertyVal, true)
      .to.have.nested.property(prop, val);
  };

  /**
   * ### .notNestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property` with
   * value given by `value`. `property` can use dot- and bracket-notation for
   * nested reference. Uses a strict equality check (===).
   *
   *     assert.notNestedPropertyVal({ tea: { green: 'matcha' }}, 'tea.green', 'konacha');
   *     assert.notNestedPropertyVal({ tea: { green: 'matcha' }}, 'coffee.green', 'matcha');
   *
   * @name notNestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notNestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notNestedPropertyVal, true)
      .to.not.have.nested.property(prop, val);
  };

  /**
   * ### .deepNestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property` with a value given
   * by `value`. `property` can use dot- and bracket-notation for nested
   * reference. Uses a deep equality check.
   *
   *     assert.deepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { matcha: 'yum' });
   *
   * @name deepNestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepNestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.deepNestedPropertyVal, true)
      .to.have.deep.nested.property(prop, val);
  };

  /**
   * ### .notDeepNestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property` with
   * value given by `value`. `property` can use dot- and bracket-notation for
   * nested reference. Uses a deep equality check.
   *
   *     assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { oolong: 'yum' });
   *     assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { matcha: 'yuck' });
   *     assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.black', { matcha: 'yum' });
   *
   * @name notDeepNestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepNestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notDeepNestedPropertyVal, true)
      .to.not.have.deep.nested.property(prop, val);
  }

  /**
   * ### .lengthOf(object, length, [message])
   *
   * Asserts that `object` has a `length` or `size` with the expected value.
   *
   *     assert.lengthOf([1,2,3], 3, 'array has length of 3');
   *     assert.lengthOf('foobar', 6, 'string has length of 6');
   *     assert.lengthOf(new Set([1,2,3]), 3, 'set has size of 3');
   *     assert.lengthOf(new Map([['a',1],['b',2],['c',3]]), 3, 'map has size of 3');
   *
   * @name lengthOf
   * @param {Mixed} object
   * @param {Number} length
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.lengthOf = function (exp, len, msg) {
    new Assertion(exp, msg, assert.lengthOf, true).to.have.lengthOf(len);
  };

  /**
   * ### .hasAnyKeys(object, [keys], [message])
   *
   * Asserts that `object` has at least one of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAnyKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'iDontExist', 'baz']);
   *     assert.hasAnyKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, iDontExist: 99, baz: 1337});
   *     assert.hasAnyKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}, 'key']);
   *     assert.hasAnyKeys(new Set([{foo: 'bar'}, 'anotherKey']), [{foo: 'bar'}, 'anotherKey']);
   *
   * @name hasAnyKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAnyKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAnyKeys, true).to.have.any.keys(keys);
  }

  /**
   * ### .hasAllKeys(object, [keys], [message])
   *
   * Asserts that `object` has all and only all of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'bar', 'baz']);
   *     assert.hasAllKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, bar: 99, baz: 1337]);
   *     assert.hasAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}, 'key']);
   *     assert.hasAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{foo: 'bar'}, 'anotherKey']);
   *
   * @name hasAllKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAllKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAllKeys, true).to.have.all.keys(keys);
  }

  /**
   * ### .containsAllKeys(object, [keys], [message])
   *
   * Asserts that `object` has all of the `keys` provided but may have more keys not listed.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'baz']);
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'bar', 'baz']);
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, baz: 1337});
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, bar: 99, baz: 1337});
   *     assert.containsAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}]);
   *     assert.containsAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}, 'key']);
   *     assert.containsAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{foo: 'bar'}]);
   *     assert.containsAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{foo: 'bar'}, 'anotherKey']);
   *
   * @name containsAllKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.containsAllKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.containsAllKeys, true)
      .to.contain.all.keys(keys);
  }

  /**
   * ### .doesNotHaveAnyKeys(object, [keys], [message])
   *
   * Asserts that `object` has none of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAnyKeys({foo: 1, bar: 2, baz: 3}, ['one', 'two', 'example']);
   *     assert.doesNotHaveAnyKeys({foo: 1, bar: 2, baz: 3}, {one: 1, two: 2, example: 'foo'});
   *     assert.doesNotHaveAnyKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{one: 'two'}, 'example']);
   *     assert.doesNotHaveAnyKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{one: 'two'}, 'example']);
   *
   * @name doesNotHaveAnyKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAnyKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAnyKeys, true)
      .to.not.have.any.keys(keys);
  }

  /**
   * ### .doesNotHaveAllKeys(object, [keys], [message])
   *
   * Asserts that `object` does not have at least one of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAllKeys({foo: 1, bar: 2, baz: 3}, ['one', 'two', 'example']);
   *     assert.doesNotHaveAllKeys({foo: 1, bar: 2, baz: 3}, {one: 1, two: 2, example: 'foo'});
   *     assert.doesNotHaveAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{one: 'two'}, 'example']);
   *     assert.doesNotHaveAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{one: 'two'}, 'example']);
   *
   * @name doesNotHaveAllKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAllKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAllKeys, true)
      .to.not.have.all.keys(keys);
  }

  /**
   * ### .hasAnyDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` has at least one of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {one: 'one'});
   *     assert.hasAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), [{one: 'one'}, {two: 'two'}]);
   *     assert.hasAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{one: 'one'}, {two: 'two'}]);
   *     assert.hasAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {one: 'one'});
   *     assert.hasAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {three: 'three'}]);
   *     assert.hasAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {two: 'two'}]);
   *
   * @name hasAnyDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAnyDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAnyDeepKeys, true)
      .to.have.any.deep.keys(keys);
  }

 /**
   * ### .hasAllDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` has all and only all of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAllDeepKeys(new Map([[{one: 'one'}, 'valueOne']]), {one: 'one'});
   *     assert.hasAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{one: 'one'}, {two: 'two'}]);
   *     assert.hasAllDeepKeys(new Set([{one: 'one'}]), {one: 'one'});
   *     assert.hasAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {two: 'two'}]);
   *
   * @name hasAllDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAllDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAllDeepKeys, true)
      .to.have.all.deep.keys(keys);
  }

 /**
   * ### .containsAllDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` contains all of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.containsAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {one: 'one'});
   *     assert.containsAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{one: 'one'}, {two: 'two'}]);
   *     assert.containsAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {one: 'one'});
   *     assert.containsAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {two: 'two'}]);
   *
   * @name containsAllDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.containsAllDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.containsAllDeepKeys, true)
      .to.contain.all.deep.keys(keys);
  }

 /**
   * ### .doesNotHaveAnyDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` has none of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {thisDoesNot: 'exist'});
   *     assert.doesNotHaveAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{twenty: 'twenty'}, {fifty: 'fifty'}]);
   *     assert.doesNotHaveAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {twenty: 'twenty'});
   *     assert.doesNotHaveAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{twenty: 'twenty'}, {fifty: 'fifty'}]);
   *
   * @name doesNotHaveAnyDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAnyDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAnyDeepKeys, true)
      .to.not.have.any.deep.keys(keys);
  }

 /**
   * ### .doesNotHaveAllDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` does not have at least one of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {thisDoesNot: 'exist'});
   *     assert.doesNotHaveAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{twenty: 'twenty'}, {one: 'one'}]);
   *     assert.doesNotHaveAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {twenty: 'twenty'});
   *     assert.doesNotHaveAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {fifty: 'fifty'}]);
   *
   * @name doesNotHaveAllDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAllDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAllDeepKeys, true)
      .to.not.have.all.deep.keys(keys);
  }

 /**
   * ### .throws(fn, [errorLike/string/regexp], [string/regexp], [message])
   *
   * If `errorLike` is an `Error` constructor, asserts that `fn` will throw an error that is an
   * instance of `errorLike`.
   * If `errorLike` is an `Error` instance, asserts that the error thrown is the same
   * instance as `errorLike`.
   * If `errMsgMatcher` is provided, it also asserts that the error thrown will have a
   * message matching `errMsgMatcher`.
   *
   *     assert.throws(fn, 'Error thrown must have this msg');
   *     assert.throws(fn, /Error thrown must have a msg that matches this/);
   *     assert.throws(fn, ReferenceError);
   *     assert.throws(fn, errorInstance);
   *     assert.throws(fn, ReferenceError, 'Error thrown must be a ReferenceError and have this msg');
   *     assert.throws(fn, errorInstance, 'Error thrown must be the same errorInstance and have this msg');
   *     assert.throws(fn, ReferenceError, /Error thrown must be a ReferenceError and match this/);
   *     assert.throws(fn, errorInstance, /Error thrown must be the same errorInstance and match this/);
   *
   * @name throws
   * @alias throw
   * @alias Throw
   * @param {Function} fn
   * @param {ErrorConstructor|Error} errorLike
   * @param {RegExp|String} errMsgMatcher
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @namespace Assert
   * @api public
   */

  assert.throws = function (fn, errorLike, errMsgMatcher, msg) {
    if ('string' === typeof errorLike || errorLike instanceof RegExp) {
      errMsgMatcher = errorLike;
      errorLike = null;
    }

    var assertErr = new Assertion(fn, msg, assert.throws, true)
      .to.throw(errorLike, errMsgMatcher);
    return flag(assertErr, 'object');
  };

  /**
   * ### .doesNotThrow(fn, [errorLike/string/regexp], [string/regexp], [message])
   *
   * If `errorLike` is an `Error` constructor, asserts that `fn` will _not_ throw an error that is an
   * instance of `errorLike`.
   * If `errorLike` is an `Error` instance, asserts that the error thrown is _not_ the same
   * instance as `errorLike`.
   * If `errMsgMatcher` is provided, it also asserts that the error thrown will _not_ have a
   * message matching `errMsgMatcher`.
   *
   *     assert.doesNotThrow(fn, 'Any Error thrown must not have this message');
   *     assert.doesNotThrow(fn, /Any Error thrown must not match this/);
   *     assert.doesNotThrow(fn, Error);
   *     assert.doesNotThrow(fn, errorInstance);
   *     assert.doesNotThrow(fn, Error, 'Error must not have this message');
   *     assert.doesNotThrow(fn, errorInstance, 'Error must not have this message');
   *     assert.doesNotThrow(fn, Error, /Error must not match this/);
   *     assert.doesNotThrow(fn, errorInstance, /Error must not match this/);
   *
   * @name doesNotThrow
   * @param {Function} fn
   * @param {ErrorConstructor} errorLike
   * @param {RegExp|String} errMsgMatcher
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @namespace Assert
   * @api public
   */

  assert.doesNotThrow = function (fn, errorLike, errMsgMatcher, msg) {
    if ('string' === typeof errorLike || errorLike instanceof RegExp) {
      errMsgMatcher = errorLike;
      errorLike = null;
    }

    new Assertion(fn, msg, assert.doesNotThrow, true)
      .to.not.throw(errorLike, errMsgMatcher);
  };

  /**
   * ### .operator(val1, operator, val2, [message])
   *
   * Compares two values using `operator`.
   *
   *     assert.operator(1, '<', 2, 'everything is ok');
   *     assert.operator(1, '>', 2, 'this will fail');
   *
   * @name operator
   * @param {Mixed} val1
   * @param {String} operator
   * @param {Mixed} val2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.operator = function (val, operator, val2, msg) {
    var ok;
    switch(operator) {
      case '==':
        ok = val == val2;
        break;
      case '===':
        ok = val === val2;
        break;
      case '>':
        ok = val > val2;
        break;
      case '>=':
        ok = val >= val2;
        break;
      case '<':
        ok = val < val2;
        break;
      case '<=':
        ok = val <= val2;
        break;
      case '!=':
        ok = val != val2;
        break;
      case '!==':
        ok = val !== val2;
        break;
      default:
        msg = msg ? msg + ': ' : msg;
        throw new chai.AssertionError(
          msg + 'Invalid operator "' + operator + '"',
          undefined,
          assert.operator
        );
    }
    var test = new Assertion(ok, msg, assert.operator, true);
    test.assert(
        true === flag(test, 'object')
      , 'expected ' + util.inspect(val) + ' to be ' + operator + ' ' + util.inspect(val2)
      , 'expected ' + util.inspect(val) + ' to not be ' + operator + ' ' + util.inspect(val2) );
  };

  /**
   * ### .closeTo(actual, expected, delta, [message])
   *
   * Asserts that the target is equal `expected`, to within a +/- `delta` range.
   *
   *     assert.closeTo(1.5, 1, 0.5, 'numbers are close');
   *
   * @name closeTo
   * @param {Number} actual
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.closeTo = function (act, exp, delta, msg) {
    new Assertion(act, msg, assert.closeTo, true).to.be.closeTo(exp, delta);
  };

  /**
   * ### .approximately(actual, expected, delta, [message])
   *
   * Asserts that the target is equal `expected`, to within a +/- `delta` range.
   *
   *     assert.approximately(1.5, 1, 0.5, 'numbers are close');
   *
   * @name approximately
   * @param {Number} actual
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.approximately = function (act, exp, delta, msg) {
    new Assertion(act, msg, assert.approximately, true)
      .to.be.approximately(exp, delta);
  };

  /**
   * ### .sameMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in any order. Uses a
   * strict equality check (===).
   *
   *     assert.sameMembers([ 1, 2, 3 ], [ 2, 1, 3 ], 'same members');
   *
   * @name sameMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameMembers, true)
      .to.have.same.members(set2);
  }

  /**
   * ### .notSameMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in any order.
   * Uses a strict equality check (===).
   *
   *     assert.notSameMembers([ 1, 2, 3 ], [ 5, 1, 3 ], 'not same members');
   *
   * @name notSameMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameMembers, true)
      .to.not.have.same.members(set2);
  }

  /**
   * ### .sameDeepMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in any order. Uses a
   * deep equality check.
   *
   *     assert.sameDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [{ b: 2 }, { a: 1 }, { c: 3 }], 'same deep members');
   *
   * @name sameDeepMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameDeepMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameDeepMembers, true)
      .to.have.same.deep.members(set2);
  }

  /**
   * ### .notSameDeepMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in any order.
   * Uses a deep equality check.
   *
   *     assert.notSameDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [{ b: 2 }, { a: 1 }, { f: 5 }], 'not same deep members');
   *
   * @name notSameDeepMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameDeepMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameDeepMembers, true)
      .to.not.have.same.deep.members(set2);
  }

  /**
   * ### .sameOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in the same order.
   * Uses a strict equality check (===).
   *
   *     assert.sameOrderedMembers([ 1, 2, 3 ], [ 1, 2, 3 ], 'same ordered members');
   *
   * @name sameOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameOrderedMembers, true)
      .to.have.same.ordered.members(set2);
  }

  /**
   * ### .notSameOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in the same
   * order. Uses a strict equality check (===).
   *
   *     assert.notSameOrderedMembers([ 1, 2, 3 ], [ 2, 1, 3 ], 'not same ordered members');
   *
   * @name notSameOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameOrderedMembers, true)
      .to.not.have.same.ordered.members(set2);
  }

  /**
   * ### .sameDeepOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in the same order.
   * Uses a deep equality check.
   *
   *     assert.sameDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { b: 2 }, { c: 3 } ], 'same deep ordered members');
   *
   * @name sameDeepOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameDeepOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameDeepOrderedMembers, true)
      .to.have.same.deep.ordered.members(set2);
  }

  /**
   * ### .notSameDeepOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in the same
   * order. Uses a deep equality check.
   *
   *     assert.notSameDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { b: 2 }, { z: 5 } ], 'not same deep ordered members');
   *     assert.notSameDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { a: 1 }, { c: 3 } ], 'not same deep ordered members');
   *
   * @name notSameDeepOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameDeepOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameDeepOrderedMembers, true)
      .to.not.have.same.deep.ordered.members(set2);
  }

  /**
   * ### .includeMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in any order. Uses a
   * strict equality check (===). Duplicates are ignored.
   *
   *     assert.includeMembers([ 1, 2, 3 ], [ 2, 1, 2 ], 'include members');
   *
   * @name includeMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeMembers, true)
      .to.include.members(subset);
  }

  /**
   * ### .notIncludeMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in any order. Uses a
   * strict equality check (===). Duplicates are ignored.
   *
   *     assert.notIncludeMembers([ 1, 2, 3 ], [ 5, 1 ], 'not include members');
   *
   * @name notIncludeMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeMembers, true)
      .to.not.include.members(subset);
  }

  /**
   * ### .includeDeepMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in any order. Uses a deep
   * equality check. Duplicates are ignored.
   *
   *     assert.includeDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { a: 1 }, { b: 2 } ], 'include deep members');
   *
   * @name includeDeepMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeDeepMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeDeepMembers, true)
      .to.include.deep.members(subset);
  }

  /**
   * ### .notIncludeDeepMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in any order. Uses a
   * deep equality check. Duplicates are ignored.
   *
   *     assert.notIncludeDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { f: 5 } ], 'not include deep members');
   *
   * @name notIncludeDeepMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeDeepMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeDeepMembers, true)
      .to.not.include.deep.members(subset);
  }

  /**
   * ### .includeOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a strict equality
   * check (===).
   *
   *     assert.includeOrderedMembers([ 1, 2, 3 ], [ 1, 2 ], 'include ordered members');
   *
   * @name includeOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeOrderedMembers, true)
      .to.include.ordered.members(subset);
  }

  /**
   * ### .notIncludeOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a strict equality
   * check (===).
   *
   *     assert.notIncludeOrderedMembers([ 1, 2, 3 ], [ 2, 1 ], 'not include ordered members');
   *     assert.notIncludeOrderedMembers([ 1, 2, 3 ], [ 2, 3 ], 'not include ordered members');
   *
   * @name notIncludeOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeOrderedMembers, true)
      .to.not.include.ordered.members(subset);
  }

  /**
   * ### .includeDeepOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a deep equality
   * check.
   *
   *     assert.includeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { b: 2 } ], 'include deep ordered members');
   *
   * @name includeDeepOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeDeepOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeDeepOrderedMembers, true)
      .to.include.deep.ordered.members(subset);
  }

  /**
   * ### .notIncludeDeepOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a deep equality
   * check.
   *
   *     assert.notIncludeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { f: 5 } ], 'not include deep ordered members');
   *     assert.notIncludeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { a: 1 } ], 'not include deep ordered members');
   *     assert.notIncludeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { c: 3 } ], 'not include deep ordered members');
   *
   * @name notIncludeDeepOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeDeepOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeDeepOrderedMembers, true)
      .to.not.include.deep.ordered.members(subset);
  }

  /**
   * ### .oneOf(inList, list, [message])
   *
   * Asserts that non-object, non-array value `inList` appears in the flat array `list`.
   *
   *     assert.oneOf(1, [ 2, 1 ], 'Not found in list');
   *
   * @name oneOf
   * @param {*} inList
   * @param {Array<*>} list
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.oneOf = function (inList, list, msg) {
    new Assertion(inList, msg, assert.oneOf, true).to.be.oneOf(list);
  }

  /**
   * ### .changes(function, object, property, [message])
   *
   * Asserts that a function changes the value of a property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 22 };
   *     assert.changes(fn, obj, 'val');
   *
   * @name changes
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.changes = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.changes, true).to.change(obj, prop);
  }

   /**
   * ### .changesBy(function, object, property, delta, [message])
   *
   * Asserts that a function changes the value of a property by an amount (delta).
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val += 2 };
   *     assert.changesBy(fn, obj, 'val', 2);
   *
   * @name changesBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.changesBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.changesBy, true)
      .to.change(obj, prop).by(delta);
  }

   /**
   * ### .doesNotChange(function, object, property, [message])
   *
   * Asserts that a function does not change the value of a property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { console.log('foo'); };
   *     assert.doesNotChange(fn, obj, 'val');
   *
   * @name doesNotChange
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotChange = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotChange, true)
      .to.not.change(obj, prop);
  }

  /**
   * ### .changesButNotBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not change the value of a property or of a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val += 10 };
   *     assert.changesButNotBy(fn, obj, 'val', 5);
   *
   * @name changesButNotBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.changesButNotBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.changesButNotBy, true)
      .to.change(obj, prop).but.not.by(delta);
  }

  /**
   * ### .increases(function, object, property, [message])
   *
   * Asserts that a function increases a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 13 };
   *     assert.increases(fn, obj, 'val');
   *
   * @name increases
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.increases = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.increases, true)
      .to.increase(obj, prop);
  }

  /**
   * ### .increasesBy(function, object, property, delta, [message])
   *
   * Asserts that a function increases a numeric object property or a function's return value by an amount (delta).
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val += 10 };
   *     assert.increasesBy(fn, obj, 'val', 10);
   *
   * @name increasesBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.increasesBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.increasesBy, true)
      .to.increase(obj, prop).by(delta);
  }

  /**
   * ### .doesNotIncrease(function, object, property, [message])
   *
   * Asserts that a function does not increase a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 8 };
   *     assert.doesNotIncrease(fn, obj, 'val');
   *
   * @name doesNotIncrease
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotIncrease = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotIncrease, true)
      .to.not.increase(obj, prop);
  }

  /**
   * ### .increasesButNotBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not increase a numeric object property or function's return value by an amount (delta).
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 15 };
   *     assert.increasesButNotBy(fn, obj, 'val', 10);
   *
   * @name increasesButNotBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.increasesButNotBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.increasesButNotBy, true)
      .to.increase(obj, prop).but.not.by(delta);
  }

  /**
   * ### .decreases(function, object, property, [message])
   *
   * Asserts that a function decreases a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 5 };
   *     assert.decreases(fn, obj, 'val');
   *
   * @name decreases
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.decreases = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.decreases, true)
      .to.decrease(obj, prop);
  }

  /**
   * ### .decreasesBy(function, object, property, delta, [message])
   *
   * Asserts that a function decreases a numeric object property or a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val -= 5 };
   *     assert.decreasesBy(fn, obj, 'val', 5);
   *
   * @name decreasesBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.decreasesBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.decreasesBy, true)
      .to.decrease(obj, prop).by(delta);
  }

  /**
   * ### .doesNotDecrease(function, object, property, [message])
   *
   * Asserts that a function does not decreases a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 15 };
   *     assert.doesNotDecrease(fn, obj, 'val');
   *
   * @name doesNotDecrease
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotDecrease = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotDecrease, true)
      .to.not.decrease(obj, prop);
  }

  /**
   * ### .doesNotDecreaseBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not decreases a numeric object property or a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 5 };
   *     assert.doesNotDecreaseBy(fn, obj, 'val', 1);
   *
   * @name doesNotDecreaseBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotDecreaseBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotDecreaseBy, true)
      .to.not.decrease(obj, prop).by(delta);
  }

  /**
   * ### .decreasesButNotBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not decreases a numeric object property or a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 5 };
   *     assert.decreasesButNotBy(fn, obj, 'val', 1);
   *
   * @name decreasesButNotBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.decreasesButNotBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.decreasesButNotBy, true)
      .to.decrease(obj, prop).but.not.by(delta);
  }

  /*!
   * ### .ifError(object)
   *
   * Asserts if value is not a false value, and throws if it is a true value.
   * This is added to allow for chai to be a drop-in replacement for Node's
   * assert class.
   *
   *     var err = new Error('I am a custom error');
   *     assert.ifError(err); // Rethrows err!
   *
   * @name ifError
   * @param {Object} object
   * @namespace Assert
   * @api public
   */

  assert.ifError = function (val) {
    if (val) {
      throw(val);
    }
  };

  /**
   * ### .isExtensible(object)
   *
   * Asserts that `object` is extensible (can have new properties added to it).
   *
   *     assert.isExtensible({});
   *
   * @name isExtensible
   * @alias extensible
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isExtensible = function (obj, msg) {
    new Assertion(obj, msg, assert.isExtensible, true).to.be.extensible;
  };

  /**
   * ### .isNotExtensible(object)
   *
   * Asserts that `object` is _not_ extensible.
   *
   *     var nonExtensibleObject = Object.preventExtensions({});
   *     var sealedObject = Object.seal({});
   *     var frozenObject = Object.freeze({});
   *
   *     assert.isNotExtensible(nonExtensibleObject);
   *     assert.isNotExtensible(sealedObject);
   *     assert.isNotExtensible(frozenObject);
   *
   * @name isNotExtensible
   * @alias notExtensible
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotExtensible = function (obj, msg) {
    new Assertion(obj, msg, assert.isNotExtensible, true).to.not.be.extensible;
  };

  /**
   * ### .isSealed(object)
   *
   * Asserts that `object` is sealed (cannot have new properties added to it
   * and its existing properties cannot be removed).
   *
   *     var sealedObject = Object.seal({});
   *     var frozenObject = Object.seal({});
   *
   *     assert.isSealed(sealedObject);
   *     assert.isSealed(frozenObject);
   *
   * @name isSealed
   * @alias sealed
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isSealed = function (obj, msg) {
    new Assertion(obj, msg, assert.isSealed, true).to.be.sealed;
  };

  /**
   * ### .isNotSealed(object)
   *
   * Asserts that `object` is _not_ sealed.
   *
   *     assert.isNotSealed({});
   *
   * @name isNotSealed
   * @alias notSealed
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotSealed = function (obj, msg) {
    new Assertion(obj, msg, assert.isNotSealed, true).to.not.be.sealed;
  };

  /**
   * ### .isFrozen(object)
   *
   * Asserts that `object` is frozen (cannot have new properties added to it
   * and its existing properties cannot be modified).
   *
   *     var frozenObject = Object.freeze({});
   *     assert.frozen(frozenObject);
   *
   * @name isFrozen
   * @alias frozen
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isFrozen = function (obj, msg) {
    new Assertion(obj, msg, assert.isFrozen, true).to.be.frozen;
  };

  /**
   * ### .isNotFrozen(object)
   *
   * Asserts that `object` is _not_ frozen.
   *
   *     assert.isNotFrozen({});
   *
   * @name isNotFrozen
   * @alias notFrozen
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotFrozen = function (obj, msg) {
    new Assertion(obj, msg, assert.isNotFrozen, true).to.not.be.frozen;
  };

  /**
   * ### .isEmpty(target)
   *
   * Asserts that the target does not contain any values.
   * For arrays and strings, it checks the `length` property.
   * For `Map` and `Set` instances, it checks the `size` property.
   * For non-function objects, it gets the count of own
   * enumerable string keys.
   *
   *     assert.isEmpty([]);
   *     assert.isEmpty('');
   *     assert.isEmpty(new Map);
   *     assert.isEmpty({});
   *
   * @name isEmpty
   * @alias empty
   * @param {Object|Array|String|Map|Set} target
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isEmpty = function(val, msg) {
    new Assertion(val, msg, assert.isEmpty, true).to.be.empty;
  };

  /**
   * ### .isNotEmpty(target)
   *
   * Asserts that the target contains values.
   * For arrays and strings, it checks the `length` property.
   * For `Map` and `Set` instances, it checks the `size` property.
   * For non-function objects, it gets the count of own
   * enumerable string keys.
   *
   *     assert.isNotEmpty([1, 2]);
   *     assert.isNotEmpty('34');
   *     assert.isNotEmpty(new Set([5, 6]));
   *     assert.isNotEmpty({ key: 7 });
   *
   * @name isNotEmpty
   * @alias notEmpty
   * @param {Object|Array|String|Map|Set} target
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotEmpty = function(val, msg) {
    new Assertion(val, msg, assert.isNotEmpty, true).to.not.be.empty;
  };

  /*!
   * Aliases.
   */

  (function alias(name, as){
    assert[as] = assert[name];
    return alias;
  })
  ('isOk', 'ok')
  ('isNotOk', 'notOk')
  ('throws', 'throw')
  ('throws', 'Throw')
  ('isExtensible', 'extensible')
  ('isNotExtensible', 'notExtensible')
  ('isSealed', 'sealed')
  ('isNotSealed', 'notSealed')
  ('isFrozen', 'frozen')
  ('isNotFrozen', 'notFrozen')
  ('isEmpty', 'empty')
  ('isNotEmpty', 'notEmpty');
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/interface/expect.js":
/***/ ((module) => {

/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  chai.expect = function (val, message) {
    return new chai.Assertion(val, message);
  };

  /**
   * ### .fail([message])
   * ### .fail(actual, expected, [message], [operator])
   *
   * Throw a failure.
   *
   *     expect.fail();
   *     expect.fail("custom error message");
   *     expect.fail(1, 2);
   *     expect.fail(1, 2, "custom error message");
   *     expect.fail(1, 2, "custom error message", ">");
   *     expect.fail(1, 2, undefined, ">");
   *
   * @name fail
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @param {String} operator
   * @namespace BDD
   * @api public
   */

  chai.expect.fail = function (actual, expected, message, operator) {
    if (arguments.length < 2) {
        message = actual;
        actual = undefined;
    }

    message = message || 'expect.fail()';
    throw new chai.AssertionError(message, {
        actual: actual
      , expected: expected
      , operator: operator
    }, chai.expect.fail);
  };
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/interface/should.js":
/***/ ((module) => {

/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  var Assertion = chai.Assertion;

  function loadShould () {
    // explicitly define this method as function as to have it's name to include as `ssfi`
    function shouldGetter() {
      if (this instanceof String
          || this instanceof Number
          || this instanceof Boolean
          || typeof Symbol === 'function' && this instanceof Symbol
          || typeof BigInt === 'function' && this instanceof BigInt) {
        return new Assertion(this.valueOf(), null, shouldGetter);
      }
      return new Assertion(this, null, shouldGetter);
    }
    function shouldSetter(value) {
      // See https://github.com/chaijs/chai/issues/86: this makes
      // `whatever.should = someValue` actually set `someValue`, which is
      // especially useful for `global.should = require('chai').should()`.
      //
      // Note that we have to use [[DefineProperty]] instead of [[Put]]
      // since otherwise we would trigger this very setter!
      Object.defineProperty(this, 'should', {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    // modify Object.prototype to have `should`
    Object.defineProperty(Object.prototype, 'should', {
      set: shouldSetter
      , get: shouldGetter
      , configurable: true
    });

    var should = {};

    /**
     * ### .fail([message])
     * ### .fail(actual, expected, [message], [operator])
     *
     * Throw a failure.
     *
     *     should.fail();
     *     should.fail("custom error message");
     *     should.fail(1, 2);
     *     should.fail(1, 2, "custom error message");
     *     should.fail(1, 2, "custom error message", ">");
     *     should.fail(1, 2, undefined, ">");
     *
     *
     * @name fail
     * @param {Mixed} actual
     * @param {Mixed} expected
     * @param {String} message
     * @param {String} operator
     * @namespace BDD
     * @api public
     */

    should.fail = function (actual, expected, message, operator) {
      if (arguments.length < 2) {
          message = actual;
          actual = undefined;
      }

      message = message || 'should.fail()';
      throw new chai.AssertionError(message, {
          actual: actual
        , expected: expected
        , operator: operator
      }, should.fail);
    };

    /**
     * ### .equal(actual, expected, [message])
     *
     * Asserts non-strict equality (`==`) of `actual` and `expected`.
     *
     *     should.equal(3, '3', '== coerces values to strings');
     *
     * @name equal
     * @param {Mixed} actual
     * @param {Mixed} expected
     * @param {String} message
     * @namespace Should
     * @api public
     */

    should.equal = function (val1, val2, msg) {
      new Assertion(val1, msg).to.equal(val2);
    };

    /**
     * ### .throw(function, [constructor/string/regexp], [string/regexp], [message])
     *
     * Asserts that `function` will throw an error that is an instance of
     * `constructor`, or alternately that it will throw an error with message
     * matching `regexp`.
     *
     *     should.throw(fn, 'function throws a reference error');
     *     should.throw(fn, /function throws a reference error/);
     *     should.throw(fn, ReferenceError);
     *     should.throw(fn, ReferenceError, 'function throws a reference error');
     *     should.throw(fn, ReferenceError, /function throws a reference error/);
     *
     * @name throw
     * @alias Throw
     * @param {Function} function
     * @param {ErrorConstructor} constructor
     * @param {RegExp} regexp
     * @param {String} message
     * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
     * @namespace Should
     * @api public
     */

    should.Throw = function (fn, errt, errs, msg) {
      new Assertion(fn, msg).to.Throw(errt, errs);
    };

    /**
     * ### .exist
     *
     * Asserts that the target is neither `null` nor `undefined`.
     *
     *     var foo = 'hi';
     *
     *     should.exist(foo, 'foo exists');
     *
     * @name exist
     * @namespace Should
     * @api public
     */

    should.exist = function (val, msg) {
      new Assertion(val, msg).to.exist;
    }

    // negation
    should.not = {}

    /**
     * ### .not.equal(actual, expected, [message])
     *
     * Asserts non-strict inequality (`!=`) of `actual` and `expected`.
     *
     *     should.not.equal(3, 4, 'these numbers are not equal');
     *
     * @name not.equal
     * @param {Mixed} actual
     * @param {Mixed} expected
     * @param {String} message
     * @namespace Should
     * @api public
     */

    should.not.equal = function (val1, val2, msg) {
      new Assertion(val1, msg).to.not.equal(val2);
    };

    /**
     * ### .throw(function, [constructor/regexp], [message])
     *
     * Asserts that `function` will _not_ throw an error that is an instance of
     * `constructor`, or alternately that it will not throw an error with message
     * matching `regexp`.
     *
     *     should.not.throw(fn, Error, 'function does not throw');
     *
     * @name not.throw
     * @alias not.Throw
     * @param {Function} function
     * @param {ErrorConstructor} constructor
     * @param {RegExp} regexp
     * @param {String} message
     * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
     * @namespace Should
     * @api public
     */

    should.not.Throw = function (fn, errt, errs, msg) {
      new Assertion(fn, msg).to.not.Throw(errt, errs);
    };

    /**
     * ### .not.exist
     *
     * Asserts that the target is neither `null` nor `undefined`.
     *
     *     var bar = null;
     *
     *     should.not.exist(bar, 'bar does not exist');
     *
     * @name not.exist
     * @namespace Should
     * @api public
     */

    should.not.exist = function (val, msg) {
      new Assertion(val, msg).to.not.exist;
    }

    should['throw'] = should['Throw'];
    should.not['throw'] = should.not['Throw'];

    return should;
  };

  chai.should = loadShould;
  chai.Should = loadShould;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/addChainableMethod.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - addChainingMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var addLengthGuard = __webpack_require__("../../node_modules/chai/lib/chai/utils/addLengthGuard.js");
var chai = __webpack_require__("../../node_modules/chai/lib/chai.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var proxify = __webpack_require__("../../node_modules/chai/lib/chai/utils/proxify.js");
var transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/*!
 * Module variables
 */

// Check whether `Object.setPrototypeOf` is supported
var canSetPrototype = typeof Object.setPrototypeOf === 'function';

// Without `Object.setPrototypeOf` support, this module will need to add properties to a function.
// However, some of functions' own props are not configurable and should be skipped.
var testFn = function() {};
var excludeNames = Object.getOwnPropertyNames(testFn).filter(function(name) {
  var propDesc = Object.getOwnPropertyDescriptor(testFn, name);

  // Note: PhantomJS 1.x includes `callee` as one of `testFn`'s own properties,
  // but then returns `undefined` as the property descriptor for `callee`. As a
  // workaround, we perform an otherwise unnecessary type-check for `propDesc`,
  // and then filter it out if it's not an object as it should be.
  if (typeof propDesc !== 'object')
    return true;

  return !propDesc.configurable;
});

// Cache `Function` properties
var call  = Function.prototype.call,
    apply = Function.prototype.apply;

/**
 * ### .addChainableMethod(ctx, name, method, chainingBehavior)
 *
 * Adds a method to an object, such that the method can also be chained.
 *
 *     utils.addChainableMethod(chai.Assertion.prototype, 'foo', function (str) {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.equal(str);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addChainableMethod('foo', fn, chainingBehavior);
 *
 * The result can then be used as both a method assertion, executing both `method` and
 * `chainingBehavior`, or as a language chain, which only executes `chainingBehavior`.
 *
 *     expect(fooStr).to.be.foo('bar');
 *     expect(fooStr).to.be.foo.equal('foo');
 *
 * @param {Object} ctx object to which the method is added
 * @param {String} name of method to add
 * @param {Function} method function to be used for `name`, when called
 * @param {Function} chainingBehavior function to be called every time the property is accessed
 * @namespace Utils
 * @name addChainableMethod
 * @api public
 */

module.exports = function addChainableMethod(ctx, name, method, chainingBehavior) {
  if (typeof chainingBehavior !== 'function') {
    chainingBehavior = function () { };
  }

  var chainableBehavior = {
      method: method
    , chainingBehavior: chainingBehavior
  };

  // save the methods so we can overwrite them later, if we need to.
  if (!ctx.__methods) {
    ctx.__methods = {};
  }
  ctx.__methods[name] = chainableBehavior;

  Object.defineProperty(ctx, name,
    { get: function chainableMethodGetter() {
        chainableBehavior.chainingBehavior.call(this);

        var chainableMethodWrapper = function () {
          // Setting the `ssfi` flag to `chainableMethodWrapper` causes this
          // function to be the starting point for removing implementation
          // frames from the stack trace of a failed assertion.
          //
          // However, we only want to use this function as the starting point if
          // the `lockSsfi` flag isn't set.
          //
          // If the `lockSsfi` flag is set, then this assertion is being
          // invoked from inside of another assertion. In this case, the `ssfi`
          // flag has already been set by the outer assertion.
          //
          // Note that overwriting a chainable method merely replaces the saved
          // methods in `ctx.__methods` instead of completely replacing the
          // overwritten assertion. Therefore, an overwriting assertion won't
          // set the `ssfi` or `lockSsfi` flags.
          if (!flag(this, 'lockSsfi')) {
            flag(this, 'ssfi', chainableMethodWrapper);
          }

          var result = chainableBehavior.method.apply(this, arguments);
          if (result !== undefined) {
            return result;
          }

          var newAssertion = new chai.Assertion();
          transferFlags(this, newAssertion);
          return newAssertion;
        };

        addLengthGuard(chainableMethodWrapper, name, true);

        // Use `Object.setPrototypeOf` if available
        if (canSetPrototype) {
          // Inherit all properties from the object by replacing the `Function` prototype
          var prototype = Object.create(this);
          // Restore the `call` and `apply` methods from `Function`
          prototype.call = call;
          prototype.apply = apply;
          Object.setPrototypeOf(chainableMethodWrapper, prototype);
        }
        // Otherwise, redefine all properties (slow!)
        else {
          var asserterNames = Object.getOwnPropertyNames(ctx);
          asserterNames.forEach(function (asserterName) {
            if (excludeNames.indexOf(asserterName) !== -1) {
              return;
            }

            var pd = Object.getOwnPropertyDescriptor(ctx, asserterName);
            Object.defineProperty(chainableMethodWrapper, asserterName, pd);
          });
        }

        transferFlags(this, chainableMethodWrapper);
        return proxify(chainableMethodWrapper);
      }
    , configurable: true
  });
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/addLengthGuard.js":
/***/ ((module) => {

var fnLengthDesc = Object.getOwnPropertyDescriptor(function () {}, 'length');

/*!
 * Chai - addLengthGuard utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .addLengthGuard(fn, assertionName, isChainable)
 *
 * Define `length` as a getter on the given uninvoked method assertion. The
 * getter acts as a guard against chaining `length` directly off of an uninvoked
 * method assertion, which is a problem because it references `function`'s
 * built-in `length` property instead of Chai's `length` assertion. When the
 * getter catches the user making this mistake, it throws an error with a
 * helpful message.
 *
 * There are two ways in which this mistake can be made. The first way is by
 * chaining the `length` assertion directly off of an uninvoked chainable
 * method. In this case, Chai suggests that the user use `lengthOf` instead. The
 * second way is by chaining the `length` assertion directly off of an uninvoked
 * non-chainable method. Non-chainable methods must be invoked prior to
 * chaining. In this case, Chai suggests that the user consult the docs for the
 * given assertion.
 *
 * If the `length` property of functions is unconfigurable, then return `fn`
 * without modification.
 *
 * Note that in ES6, the function's `length` property is configurable, so once
 * support for legacy environments is dropped, Chai's `length` property can
 * replace the built-in function's `length` property, and this length guard will
 * no longer be necessary. In the mean time, maintaining consistency across all
 * environments is the priority.
 *
 * @param {Function} fn
 * @param {String} assertionName
 * @param {Boolean} isChainable
 * @namespace Utils
 * @name addLengthGuard
 */

module.exports = function addLengthGuard (fn, assertionName, isChainable) {
  if (!fnLengthDesc.configurable) return fn;

  Object.defineProperty(fn, 'length', {
    get: function () {
      if (isChainable) {
        throw Error('Invalid Chai property: ' + assertionName + '.length. Due' +
          ' to a compatibility issue, "length" cannot directly follow "' +
          assertionName + '". Use "' + assertionName + '.lengthOf" instead.');
      }

      throw Error('Invalid Chai property: ' + assertionName + '.length. See' +
        ' docs for proper usage of "' + assertionName + '".');
    }
  });

  return fn;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/addMethod.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - addMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var addLengthGuard = __webpack_require__("../../node_modules/chai/lib/chai/utils/addLengthGuard.js");
var chai = __webpack_require__("../../node_modules/chai/lib/chai.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var proxify = __webpack_require__("../../node_modules/chai/lib/chai/utils/proxify.js");
var transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/**
 * ### .addMethod(ctx, name, method)
 *
 * Adds a method to the prototype of an object.
 *
 *     utils.addMethod(chai.Assertion.prototype, 'foo', function (str) {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.equal(str);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addMethod('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(fooStr).to.be.foo('bar');
 *
 * @param {Object} ctx object to which the method is added
 * @param {String} name of method to add
 * @param {Function} method function to be used for name
 * @namespace Utils
 * @name addMethod
 * @api public
 */

module.exports = function addMethod(ctx, name, method) {
  var methodWrapper = function () {
    // Setting the `ssfi` flag to `methodWrapper` causes this function to be the
    // starting point for removing implementation frames from the stack trace of
    // a failed assertion.
    //
    // However, we only want to use this function as the starting point if the
    // `lockSsfi` flag isn't set.
    //
    // If the `lockSsfi` flag is set, then either this assertion has been
    // overwritten by another assertion, or this assertion is being invoked from
    // inside of another assertion. In the first case, the `ssfi` flag has
    // already been set by the overwriting assertion. In the second case, the
    // `ssfi` flag has already been set by the outer assertion.
    if (!flag(this, 'lockSsfi')) {
      flag(this, 'ssfi', methodWrapper);
    }

    var result = method.apply(this, arguments);
    if (result !== undefined)
      return result;

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  };

  addLengthGuard(methodWrapper, name, false);
  ctx[name] = proxify(methodWrapper, name);
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/addProperty.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - addProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var chai = __webpack_require__("../../node_modules/chai/lib/chai.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var isProxyEnabled = __webpack_require__("../../node_modules/chai/lib/chai/utils/isProxyEnabled.js");
var transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/**
 * ### .addProperty(ctx, name, getter)
 *
 * Adds a property to the prototype of an object.
 *
 *     utils.addProperty(chai.Assertion.prototype, 'foo', function () {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.instanceof(Foo);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addProperty('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.be.foo;
 *
 * @param {Object} ctx object to which the property is added
 * @param {String} name of property to add
 * @param {Function} getter function to be used for name
 * @namespace Utils
 * @name addProperty
 * @api public
 */

module.exports = function addProperty(ctx, name, getter) {
  getter = getter === undefined ? function () {} : getter;

  Object.defineProperty(ctx, name,
    { get: function propertyGetter() {
        // Setting the `ssfi` flag to `propertyGetter` causes this function to
        // be the starting point for removing implementation frames from the
        // stack trace of a failed assertion.
        //
        // However, we only want to use this function as the starting point if
        // the `lockSsfi` flag isn't set and proxy protection is disabled.
        //
        // If the `lockSsfi` flag is set, then either this assertion has been
        // overwritten by another assertion, or this assertion is being invoked
        // from inside of another assertion. In the first case, the `ssfi` flag
        // has already been set by the overwriting assertion. In the second
        // case, the `ssfi` flag has already been set by the outer assertion.
        //
        // If proxy protection is enabled, then the `ssfi` flag has already been
        // set by the proxy getter.
        if (!isProxyEnabled() && !flag(this, 'lockSsfi')) {
          flag(this, 'ssfi', propertyGetter);
        }

        var result = getter.call(this);
        if (result !== undefined)
          return result;

        var newAssertion = new chai.Assertion();
        transferFlags(this, newAssertion);
        return newAssertion;
      }
    , configurable: true
  });
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/compareByInspect.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - compareByInspect utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var inspect = __webpack_require__("../../node_modules/chai/lib/chai/utils/inspect.js");

/**
 * ### .compareByInspect(mixed, mixed)
 *
 * To be used as a compareFunction with Array.prototype.sort. Compares elements
 * using inspect instead of default behavior of using toString so that Symbols
 * and objects with irregular/missing toString can still be sorted without a
 * TypeError.
 *
 * @param {Mixed} first element to compare
 * @param {Mixed} second element to compare
 * @returns {Number} -1 if 'a' should come before 'b'; otherwise 1
 * @name compareByInspect
 * @namespace Utils
 * @api public
 */

module.exports = function compareByInspect(a, b) {
  return inspect(a) < inspect(b) ? -1 : 1;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/expectTypes.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - expectTypes utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .expectTypes(obj, types)
 *
 * Ensures that the object being tested against is of a valid type.
 *
 *     utils.expectTypes(this, ['array', 'object', 'string']);
 *
 * @param {Mixed} obj constructed Assertion
 * @param {Array} type A list of allowed types for this assertion
 * @namespace Utils
 * @name expectTypes
 * @api public
 */

var AssertionError = __webpack_require__("../../node_modules/assertion-error/index.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var type = __webpack_require__("../../node_modules/type-detect/type-detect.js");

module.exports = function expectTypes(obj, types) {
  var flagMsg = flag(obj, 'message');
  var ssfi = flag(obj, 'ssfi');

  flagMsg = flagMsg ? flagMsg + ': ' : '';

  obj = flag(obj, 'object');
  types = types.map(function (t) { return t.toLowerCase(); });
  types.sort();

  // Transforms ['lorem', 'ipsum'] into 'a lorem, or an ipsum'
  var str = types.map(function (t, index) {
    var art = ~[ 'a', 'e', 'i', 'o', 'u' ].indexOf(t.charAt(0)) ? 'an' : 'a';
    var or = types.length > 1 && index === types.length - 1 ? 'or ' : '';
    return or + art + ' ' + t;
  }).join(', ');

  var objType = type(obj).toLowerCase();

  if (!types.some(function (expected) { return objType === expected; })) {
    throw new AssertionError(
      flagMsg + 'object tested must be ' + str + ', but ' + objType + ' given',
      undefined,
      ssfi
    );
  }
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/flag.js":
/***/ ((module) => {

/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .flag(object, key, [value])
 *
 * Get or set a flag value on an object. If a
 * value is provided it will be set, else it will
 * return the currently set value or `undefined` if
 * the value is not set.
 *
 *     utils.flag(this, 'foo', 'bar'); // setter
 *     utils.flag(this, 'foo'); // getter, returns `bar`
 *
 * @param {Object} object constructed Assertion
 * @param {String} key
 * @param {Mixed} value (optional)
 * @namespace Utils
 * @name flag
 * @api private
 */

module.exports = function flag(obj, key, value) {
  var flags = obj.__flags || (obj.__flags = Object.create(null));
  if (arguments.length === 3) {
    flags[key] = value;
  } else {
    return flags[key];
  }
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/getActual.js":
/***/ ((module) => {

/*!
 * Chai - getActual utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getActual(object, [actual])
 *
 * Returns the `actual` value for an Assertion.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name getActual
 */

module.exports = function getActual(obj, args) {
  return args.length > 4 ? args[4] : obj._obj;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/getMessage.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - message composition utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js")
  , getActual = __webpack_require__("../../node_modules/chai/lib/chai/utils/getActual.js")
  , objDisplay = __webpack_require__("../../node_modules/chai/lib/chai/utils/objDisplay.js");

/**
 * ### .getMessage(object, message, negateMessage)
 *
 * Construct the error message based on flags
 * and template tags. Template tags will return
 * a stringified inspection of the object referenced.
 *
 * Message template tags:
 * - `#{this}` current asserted object
 * - `#{act}` actual value
 * - `#{exp}` expected value
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name getMessage
 * @api public
 */

module.exports = function getMessage(obj, args) {
  var negate = flag(obj, 'negate')
    , val = flag(obj, 'object')
    , expected = args[3]
    , actual = getActual(obj, args)
    , msg = negate ? args[2] : args[1]
    , flagMsg = flag(obj, 'message');

  if(typeof msg === "function") msg = msg();
  msg = msg || '';
  msg = msg
    .replace(/#\{this\}/g, function () { return objDisplay(val); })
    .replace(/#\{act\}/g, function () { return objDisplay(actual); })
    .replace(/#\{exp\}/g, function () { return objDisplay(expected); });

  return flagMsg ? flagMsg + ': ' + msg : msg;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/getOperator.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var type = __webpack_require__("../../node_modules/type-detect/type-detect.js");

var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");

function isObjectType(obj) {
  var objectType = type(obj);
  var objectTypes = ['Array', 'Object', 'function'];

  return objectTypes.indexOf(objectType) !== -1;
}

/**
 * ### .getOperator(message)
 *
 * Extract the operator from error message.
 * Operator defined is based on below link
 * https://nodejs.org/api/assert.html#assert_assert.
 *
 * Returns the `operator` or `undefined` value for an Assertion.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name getOperator
 * @api public
 */

module.exports = function getOperator(obj, args) {
  var operator = flag(obj, 'operator');
  var negate = flag(obj, 'negate');
  var expected = args[3];
  var msg = negate ? args[2] : args[1];

  if (operator) {
    return operator;
  }

  if (typeof msg === 'function') msg = msg();

  msg = msg || '';
  if (!msg) {
    return undefined;
  }

  if (/\shave\s/.test(msg)) {
    return undefined;
  }

  var isObject = isObjectType(expected);
  if (/\snot\s/.test(msg)) {
    return isObject ? 'notDeepStrictEqual' : 'notStrictEqual';
  }

  return isObject ? 'deepStrictEqual' : 'strictEqual';
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/getOwnEnumerableProperties.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - getOwnEnumerableProperties utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var getOwnEnumerablePropertySymbols = __webpack_require__("../../node_modules/chai/lib/chai/utils/getOwnEnumerablePropertySymbols.js");

/**
 * ### .getOwnEnumerableProperties(object)
 *
 * This allows the retrieval of directly-owned enumerable property names and
 * symbols of an object. This function is necessary because Object.keys only
 * returns enumerable property names, not enumerable property symbols.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getOwnEnumerableProperties
 * @api public
 */

module.exports = function getOwnEnumerableProperties(obj) {
  return Object.keys(obj).concat(getOwnEnumerablePropertySymbols(obj));
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/getOwnEnumerablePropertySymbols.js":
/***/ ((module) => {

/*!
 * Chai - getOwnEnumerablePropertySymbols utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getOwnEnumerablePropertySymbols(object)
 *
 * This allows the retrieval of directly-owned enumerable property symbols of an
 * object. This function is necessary because Object.getOwnPropertySymbols
 * returns both enumerable and non-enumerable property symbols.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getOwnEnumerablePropertySymbols
 * @api public
 */

module.exports = function getOwnEnumerablePropertySymbols(obj) {
  if (typeof Object.getOwnPropertySymbols !== 'function') return [];

  return Object.getOwnPropertySymbols(obj).filter(function (sym) {
    return Object.getOwnPropertyDescriptor(obj, sym).enumerable;
  });
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/getProperties.js":
/***/ ((module) => {

/*!
 * Chai - getProperties utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getProperties(object)
 *
 * This allows the retrieval of property names of an object, enumerable or not,
 * inherited or not.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getProperties
 * @api public
 */

module.exports = function getProperties(object) {
  var result = Object.getOwnPropertyNames(object);

  function addProperty(property) {
    if (result.indexOf(property) === -1) {
      result.push(property);
    }
  }

  var proto = Object.getPrototypeOf(object);
  while (proto !== null) {
    Object.getOwnPropertyNames(proto).forEach(addProperty);
    proto = Object.getPrototypeOf(proto);
  }

  return result;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Dependencies that are used for multiple exports are required here only once
 */

var pathval = __webpack_require__("../../node_modules/pathval/index.js");

/*!
 * test utility
 */

exports.test = __webpack_require__("../../node_modules/chai/lib/chai/utils/test.js");

/*!
 * type utility
 */

exports.type = __webpack_require__("../../node_modules/type-detect/type-detect.js");

/*!
 * expectTypes utility
 */
exports.expectTypes = __webpack_require__("../../node_modules/chai/lib/chai/utils/expectTypes.js");

/*!
 * message utility
 */

exports.getMessage = __webpack_require__("../../node_modules/chai/lib/chai/utils/getMessage.js");

/*!
 * actual utility
 */

exports.getActual = __webpack_require__("../../node_modules/chai/lib/chai/utils/getActual.js");

/*!
 * Inspect util
 */

exports.inspect = __webpack_require__("../../node_modules/chai/lib/chai/utils/inspect.js");

/*!
 * Object Display util
 */

exports.objDisplay = __webpack_require__("../../node_modules/chai/lib/chai/utils/objDisplay.js");

/*!
 * Flag utility
 */

exports.flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");

/*!
 * Flag transferring utility
 */

exports.transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/*!
 * Deep equal utility
 */

exports.eql = __webpack_require__("../../node_modules/deep-eql/index.js");

/*!
 * Deep path info
 */

exports.getPathInfo = pathval.getPathInfo;

/*!
 * Check if a property exists
 */

exports.hasProperty = pathval.hasProperty;

/*!
 * Function name
 */

exports.getName = __webpack_require__("../../node_modules/get-func-name/index.js");

/*!
 * add Property
 */

exports.addProperty = __webpack_require__("../../node_modules/chai/lib/chai/utils/addProperty.js");

/*!
 * add Method
 */

exports.addMethod = __webpack_require__("../../node_modules/chai/lib/chai/utils/addMethod.js");

/*!
 * overwrite Property
 */

exports.overwriteProperty = __webpack_require__("../../node_modules/chai/lib/chai/utils/overwriteProperty.js");

/*!
 * overwrite Method
 */

exports.overwriteMethod = __webpack_require__("../../node_modules/chai/lib/chai/utils/overwriteMethod.js");

/*!
 * Add a chainable method
 */

exports.addChainableMethod = __webpack_require__("../../node_modules/chai/lib/chai/utils/addChainableMethod.js");

/*!
 * Overwrite chainable method
 */

exports.overwriteChainableMethod = __webpack_require__("../../node_modules/chai/lib/chai/utils/overwriteChainableMethod.js");

/*!
 * Compare by inspect method
 */

exports.compareByInspect = __webpack_require__("../../node_modules/chai/lib/chai/utils/compareByInspect.js");

/*!
 * Get own enumerable property symbols method
 */

exports.getOwnEnumerablePropertySymbols = __webpack_require__("../../node_modules/chai/lib/chai/utils/getOwnEnumerablePropertySymbols.js");

/*!
 * Get own enumerable properties method
 */

exports.getOwnEnumerableProperties = __webpack_require__("../../node_modules/chai/lib/chai/utils/getOwnEnumerableProperties.js");

/*!
 * Checks error against a given set of criteria
 */

exports.checkError = __webpack_require__("../../node_modules/check-error/index.js");

/*!
 * Proxify util
 */

exports.proxify = __webpack_require__("../../node_modules/chai/lib/chai/utils/proxify.js");

/*!
 * addLengthGuard util
 */

exports.addLengthGuard = __webpack_require__("../../node_modules/chai/lib/chai/utils/addLengthGuard.js");

/*!
 * isProxyEnabled helper
 */

exports.isProxyEnabled = __webpack_require__("../../node_modules/chai/lib/chai/utils/isProxyEnabled.js");

/*!
 * isNaN method
 */

exports.isNaN = __webpack_require__("../../node_modules/chai/lib/chai/utils/isNaN.js");

/*!
 * getOperator method
 */

exports.getOperator = __webpack_require__("../../node_modules/chai/lib/chai/utils/getOperator.js");

/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/inspect.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// This is (almost) directly from Node.js utils
// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/util.js

var getName = __webpack_require__("../../node_modules/get-func-name/index.js");
var loupe = __webpack_require__("../../node_modules/loupe/loupe.js");
var config = __webpack_require__("../../node_modules/chai/lib/chai/config.js");

module.exports = inspect;

/**
 * ### .inspect(obj, [showHidden], [depth], [colors])
 *
 * Echoes the value of a value. Tries to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Boolean} showHidden Flag that shows hidden (not enumerable)
 *    properties of objects. Default is false.
 * @param {Number} depth Depth in which to descend in object. Default is 2.
 * @param {Boolean} colors Flag to turn on ANSI escape codes to color the
 *    output. Default is false (no coloring).
 * @namespace Utils
 * @name inspect
 */
function inspect(obj, showHidden, depth, colors) {
  var options = {
    colors: colors,
    depth: (typeof depth === 'undefined' ? 2 : depth),
    showHidden: showHidden,
    truncate: config.truncateThreshold ? config.truncateThreshold : Infinity,
  };
  return loupe.inspect(obj, options);
}


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/isNaN.js":
/***/ ((module) => {

/*!
 * Chai - isNaN utility
 * Copyright(c) 2012-2015 Sakthipriyan Vairamani <thechargingvolcano@gmail.com>
 * MIT Licensed
 */

/**
 * ### .isNaN(value)
 *
 * Checks if the given value is NaN or not.
 *
 *     utils.isNaN(NaN); // true
 *
 * @param {Value} The value which has to be checked if it is NaN
 * @name isNaN
 * @api private
 */

function isNaN(value) {
  // Refer http://www.ecma-international.org/ecma-262/6.0/#sec-isnan-number
  // section's NOTE.
  return value !== value;
}

// If ECMAScript 6's Number.isNaN is present, prefer that.
module.exports = Number.isNaN || isNaN;


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/isProxyEnabled.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var config = __webpack_require__("../../node_modules/chai/lib/chai/config.js");

/*!
 * Chai - isProxyEnabled helper
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .isProxyEnabled()
 *
 * Helper function to check if Chai's proxy protection feature is enabled. If
 * proxies are unsupported or disabled via the user's Chai config, then return
 * false. Otherwise, return true.
 *
 * @namespace Utils
 * @name isProxyEnabled
 */

module.exports = function isProxyEnabled() {
  return config.useProxy &&
    typeof Proxy !== 'undefined' &&
    typeof Reflect !== 'undefined';
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/objDisplay.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var inspect = __webpack_require__("../../node_modules/chai/lib/chai/utils/inspect.js");
var config = __webpack_require__("../../node_modules/chai/lib/chai/config.js");

/**
 * ### .objDisplay(object)
 *
 * Determines if an object or an array matches
 * criteria to be inspected in-line for error
 * messages or should be truncated.
 *
 * @param {Mixed} javascript object to inspect
 * @name objDisplay
 * @namespace Utils
 * @api public
 */

module.exports = function objDisplay(obj) {
  var str = inspect(obj)
    , type = Object.prototype.toString.call(obj);

  if (config.truncateThreshold && str.length >= config.truncateThreshold) {
    if (type === '[object Function]') {
      return !obj.name || obj.name === ''
        ? '[Function]'
        : '[Function: ' + obj.name + ']';
    } else if (type === '[object Array]') {
      return '[ Array(' + obj.length + ') ]';
    } else if (type === '[object Object]') {
      var keys = Object.keys(obj)
        , kstr = keys.length > 2
          ? keys.splice(0, 2).join(', ') + ', ...'
          : keys.join(', ');
      return '{ Object (' + kstr + ') }';
    } else {
      return str;
    }
  } else {
    return str;
  }
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/overwriteChainableMethod.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - overwriteChainableMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var chai = __webpack_require__("../../node_modules/chai/lib/chai.js");
var transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/**
 * ### .overwriteChainableMethod(ctx, name, method, chainingBehavior)
 *
 * Overwrites an already existing chainable method
 * and provides access to the previous function or
 * property.  Must return functions to be used for
 * name.
 *
 *     utils.overwriteChainableMethod(chai.Assertion.prototype, 'lengthOf',
 *       function (_super) {
 *       }
 *     , function (_super) {
 *       }
 *     );
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteChainableMethod('foo', fn, fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.have.lengthOf(3);
 *     expect(myFoo).to.have.lengthOf.above(3);
 *
 * @param {Object} ctx object whose method / property is to be overwritten
 * @param {String} name of method / property to overwrite
 * @param {Function} method function that returns a function to be used for name
 * @param {Function} chainingBehavior function that returns a function to be used for property
 * @namespace Utils
 * @name overwriteChainableMethod
 * @api public
 */

module.exports = function overwriteChainableMethod(ctx, name, method, chainingBehavior) {
  var chainableBehavior = ctx.__methods[name];

  var _chainingBehavior = chainableBehavior.chainingBehavior;
  chainableBehavior.chainingBehavior = function overwritingChainableMethodGetter() {
    var result = chainingBehavior(_chainingBehavior).call(this);
    if (result !== undefined) {
      return result;
    }

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  };

  var _method = chainableBehavior.method;
  chainableBehavior.method = function overwritingChainableMethodWrapper() {
    var result = method(_method).apply(this, arguments);
    if (result !== undefined) {
      return result;
    }

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  };
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/overwriteMethod.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - overwriteMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var addLengthGuard = __webpack_require__("../../node_modules/chai/lib/chai/utils/addLengthGuard.js");
var chai = __webpack_require__("../../node_modules/chai/lib/chai.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var proxify = __webpack_require__("../../node_modules/chai/lib/chai/utils/proxify.js");
var transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/**
 * ### .overwriteMethod(ctx, name, fn)
 *
 * Overwrites an already existing method and provides
 * access to previous function. Must return function
 * to be used for name.
 *
 *     utils.overwriteMethod(chai.Assertion.prototype, 'equal', function (_super) {
 *       return function (str) {
 *         var obj = utils.flag(this, 'object');
 *         if (obj instanceof Foo) {
 *           new chai.Assertion(obj.value).to.equal(str);
 *         } else {
 *           _super.apply(this, arguments);
 *         }
 *       }
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteMethod('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.equal('bar');
 *
 * @param {Object} ctx object whose method is to be overwritten
 * @param {String} name of method to overwrite
 * @param {Function} method function that returns a function to be used for name
 * @namespace Utils
 * @name overwriteMethod
 * @api public
 */

module.exports = function overwriteMethod(ctx, name, method) {
  var _method = ctx[name]
    , _super = function () {
      throw new Error(name + ' is not a function');
    };

  if (_method && 'function' === typeof _method)
    _super = _method;

  var overwritingMethodWrapper = function () {
    // Setting the `ssfi` flag to `overwritingMethodWrapper` causes this
    // function to be the starting point for removing implementation frames from
    // the stack trace of a failed assertion.
    //
    // However, we only want to use this function as the starting point if the
    // `lockSsfi` flag isn't set.
    //
    // If the `lockSsfi` flag is set, then either this assertion has been
    // overwritten by another assertion, or this assertion is being invoked from
    // inside of another assertion. In the first case, the `ssfi` flag has
    // already been set by the overwriting assertion. In the second case, the
    // `ssfi` flag has already been set by the outer assertion.
    if (!flag(this, 'lockSsfi')) {
      flag(this, 'ssfi', overwritingMethodWrapper);
    }

    // Setting the `lockSsfi` flag to `true` prevents the overwritten assertion
    // from changing the `ssfi` flag. By this point, the `ssfi` flag is already
    // set to the correct starting point for this assertion.
    var origLockSsfi = flag(this, 'lockSsfi');
    flag(this, 'lockSsfi', true);
    var result = method(_super).apply(this, arguments);
    flag(this, 'lockSsfi', origLockSsfi);

    if (result !== undefined) {
      return result;
    }

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  }

  addLengthGuard(overwritingMethodWrapper, name, false);
  ctx[name] = proxify(overwritingMethodWrapper, name);
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/overwriteProperty.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - overwriteProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var chai = __webpack_require__("../../node_modules/chai/lib/chai.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var isProxyEnabled = __webpack_require__("../../node_modules/chai/lib/chai/utils/isProxyEnabled.js");
var transferFlags = __webpack_require__("../../node_modules/chai/lib/chai/utils/transferFlags.js");

/**
 * ### .overwriteProperty(ctx, name, fn)
 *
 * Overwrites an already existing property getter and provides
 * access to previous value. Must return function to use as getter.
 *
 *     utils.overwriteProperty(chai.Assertion.prototype, 'ok', function (_super) {
 *       return function () {
 *         var obj = utils.flag(this, 'object');
 *         if (obj instanceof Foo) {
 *           new chai.Assertion(obj.name).to.equal('bar');
 *         } else {
 *           _super.call(this);
 *         }
 *       }
 *     });
 *
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteProperty('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.be.ok;
 *
 * @param {Object} ctx object whose property is to be overwritten
 * @param {String} name of property to overwrite
 * @param {Function} getter function that returns a getter function to be used for name
 * @namespace Utils
 * @name overwriteProperty
 * @api public
 */

module.exports = function overwriteProperty(ctx, name, getter) {
  var _get = Object.getOwnPropertyDescriptor(ctx, name)
    , _super = function () {};

  if (_get && 'function' === typeof _get.get)
    _super = _get.get

  Object.defineProperty(ctx, name,
    { get: function overwritingPropertyGetter() {
        // Setting the `ssfi` flag to `overwritingPropertyGetter` causes this
        // function to be the starting point for removing implementation frames
        // from the stack trace of a failed assertion.
        //
        // However, we only want to use this function as the starting point if
        // the `lockSsfi` flag isn't set and proxy protection is disabled.
        //
        // If the `lockSsfi` flag is set, then either this assertion has been
        // overwritten by another assertion, or this assertion is being invoked
        // from inside of another assertion. In the first case, the `ssfi` flag
        // has already been set by the overwriting assertion. In the second
        // case, the `ssfi` flag has already been set by the outer assertion.
        //
        // If proxy protection is enabled, then the `ssfi` flag has already been
        // set by the proxy getter.
        if (!isProxyEnabled() && !flag(this, 'lockSsfi')) {
          flag(this, 'ssfi', overwritingPropertyGetter);
        }

        // Setting the `lockSsfi` flag to `true` prevents the overwritten
        // assertion from changing the `ssfi` flag. By this point, the `ssfi`
        // flag is already set to the correct starting point for this assertion.
        var origLockSsfi = flag(this, 'lockSsfi');
        flag(this, 'lockSsfi', true);
        var result = getter(_super).call(this);
        flag(this, 'lockSsfi', origLockSsfi);

        if (result !== undefined) {
          return result;
        }

        var newAssertion = new chai.Assertion();
        transferFlags(this, newAssertion);
        return newAssertion;
      }
    , configurable: true
  });
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/proxify.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var config = __webpack_require__("../../node_modules/chai/lib/chai/config.js");
var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");
var getProperties = __webpack_require__("../../node_modules/chai/lib/chai/utils/getProperties.js");
var isProxyEnabled = __webpack_require__("../../node_modules/chai/lib/chai/utils/isProxyEnabled.js");

/*!
 * Chai - proxify utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .proxify(object)
 *
 * Return a proxy of given object that throws an error when a non-existent
 * property is read. By default, the root cause is assumed to be a misspelled
 * property, and thus an attempt is made to offer a reasonable suggestion from
 * the list of existing properties. However, if a nonChainableMethodName is
 * provided, then the root cause is instead a failure to invoke a non-chainable
 * method prior to reading the non-existent property.
 *
 * If proxies are unsupported or disabled via the user's Chai config, then
 * return object without modification.
 *
 * @param {Object} obj
 * @param {String} nonChainableMethodName
 * @namespace Utils
 * @name proxify
 */

var builtins = ['__flags', '__methods', '_obj', 'assert'];

module.exports = function proxify(obj, nonChainableMethodName) {
  if (!isProxyEnabled()) return obj;

  return new Proxy(obj, {
    get: function proxyGetter(target, property) {
      // This check is here because we should not throw errors on Symbol properties
      // such as `Symbol.toStringTag`.
      // The values for which an error should be thrown can be configured using
      // the `config.proxyExcludedKeys` setting.
      if (typeof property === 'string' &&
          config.proxyExcludedKeys.indexOf(property) === -1 &&
          !Reflect.has(target, property)) {
        // Special message for invalid property access of non-chainable methods.
        if (nonChainableMethodName) {
          throw Error('Invalid Chai property: ' + nonChainableMethodName + '.' +
            property + '. See docs for proper usage of "' +
            nonChainableMethodName + '".');
        }

        // If the property is reasonably close to an existing Chai property,
        // suggest that property to the user. Only suggest properties with a
        // distance less than 4.
        var suggestion = null;
        var suggestionDistance = 4;
        getProperties(target).forEach(function(prop) {
          if (
            !Object.prototype.hasOwnProperty(prop) &&
            builtins.indexOf(prop) === -1
          ) {
            var dist = stringDistanceCapped(
              property,
              prop,
              suggestionDistance
            );
            if (dist < suggestionDistance) {
              suggestion = prop;
              suggestionDistance = dist;
            }
          }
        });

        if (suggestion !== null) {
          throw Error('Invalid Chai property: ' + property +
            '. Did you mean "' + suggestion + '"?');
        } else {
          throw Error('Invalid Chai property: ' + property);
        }
      }

      // Use this proxy getter as the starting point for removing implementation
      // frames from the stack trace of a failed assertion. For property
      // assertions, this prevents the proxy getter from showing up in the stack
      // trace since it's invoked before the property getter. For method and
      // chainable method assertions, this flag will end up getting changed to
      // the method wrapper, which is good since this frame will no longer be in
      // the stack once the method is invoked. Note that Chai builtin assertion
      // properties such as `__flags` are skipped since this is only meant to
      // capture the starting point of an assertion. This step is also skipped
      // if the `lockSsfi` flag is set, thus indicating that this assertion is
      // being called from within another assertion. In that case, the `ssfi`
      // flag is already set to the outer assertion's starting point.
      if (builtins.indexOf(property) === -1 && !flag(target, 'lockSsfi')) {
        flag(target, 'ssfi', proxyGetter);
      }

      return Reflect.get(target, property);
    }
  });
};

/**
 * # stringDistanceCapped(strA, strB, cap)
 * Return the Levenshtein distance between two strings, but no more than cap.
 * @param {string} strA
 * @param {string} strB
 * @param {number} number
 * @return {number} min(string distance between strA and strB, cap)
 * @api private
 */

function stringDistanceCapped(strA, strB, cap) {
  if (Math.abs(strA.length - strB.length) >= cap) {
    return cap;
  }

  var memo = [];
  // `memo` is a two-dimensional array containing distances.
  // memo[i][j] is the distance between strA.slice(0, i) and
  // strB.slice(0, j).
  for (var i = 0; i <= strA.length; i++) {
    memo[i] = Array(strB.length + 1).fill(0);
    memo[i][0] = i;
  }
  for (var j = 0; j < strB.length; j++) {
    memo[0][j] = j;
  }

  for (var i = 1; i <= strA.length; i++) {
    var ch = strA.charCodeAt(i - 1);
    for (var j = 1; j <= strB.length; j++) {
      if (Math.abs(i - j) >= cap) {
        memo[i][j] = cap;
        continue;
      }
      memo[i][j] = Math.min(
        memo[i - 1][j] + 1,
        memo[i][j - 1] + 1,
        memo[i - 1][j - 1] +
          (ch === strB.charCodeAt(j - 1) ? 0 : 1)
      );
    }
  }

  return memo[strA.length][strB.length];
}


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/test.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Chai - test utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var flag = __webpack_require__("../../node_modules/chai/lib/chai/utils/flag.js");

/**
 * ### .test(object, expression)
 *
 * Test and object for expression.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name test
 */

module.exports = function test(obj, args) {
  var negate = flag(obj, 'negate')
    , expr = args[0];
  return negate ? !expr : expr;
};


/***/ }),

/***/ "../../node_modules/chai/lib/chai/utils/transferFlags.js":
/***/ ((module) => {

/*!
 * Chai - transferFlags utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .transferFlags(assertion, object, includeAll = true)
 *
 * Transfer all the flags for `assertion` to `object`. If
 * `includeAll` is set to `false`, then the base Chai
 * assertion flags (namely `object`, `ssfi`, `lockSsfi`,
 * and `message`) will not be transferred.
 *
 *
 *     var newAssertion = new Assertion();
 *     utils.transferFlags(assertion, newAssertion);
 *
 *     var anotherAssertion = new Assertion(myObj);
 *     utils.transferFlags(assertion, anotherAssertion, false);
 *
 * @param {Assertion} assertion the assertion to transfer the flags from
 * @param {Object} object the object to transfer the flags to; usually a new assertion
 * @param {Boolean} includeAll
 * @namespace Utils
 * @name transferFlags
 * @api private
 */

module.exports = function transferFlags(assertion, object, includeAll) {
  var flags = assertion.__flags || (assertion.__flags = Object.create(null));

  if (!object.__flags) {
    object.__flags = Object.create(null);
  }

  includeAll = arguments.length === 3 ? includeAll : true;

  for (var flag in flags) {
    if (includeAll ||
        (flag !== 'object' && flag !== 'ssfi' && flag !== 'lockSsfi' && flag != 'message')) {
      object.__flags[flag] = flags[flag];
    }
  }
};


/***/ }),

/***/ "../../node_modules/check-error/index.js":
/***/ ((module) => {



/* !
 * Chai - checkError utility
 * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .checkError
 *
 * Checks that an error conforms to a given set of criteria and/or retrieves information about it.
 *
 * @api public
 */

/**
 * ### .compatibleInstance(thrown, errorLike)
 *
 * Checks if two instances are compatible (strict equal).
 * Returns false if errorLike is not an instance of Error, because instances
 * can only be compatible if they're both error instances.
 *
 * @name compatibleInstance
 * @param {Error} thrown error
 * @param {Error|ErrorConstructor} errorLike object to compare against
 * @namespace Utils
 * @api public
 */

function compatibleInstance(thrown, errorLike) {
  return errorLike instanceof Error && thrown === errorLike;
}

/**
 * ### .compatibleConstructor(thrown, errorLike)
 *
 * Checks if two constructors are compatible.
 * This function can receive either an error constructor or
 * an error instance as the `errorLike` argument.
 * Constructors are compatible if they're the same or if one is
 * an instance of another.
 *
 * @name compatibleConstructor
 * @param {Error} thrown error
 * @param {Error|ErrorConstructor} errorLike object to compare against
 * @namespace Utils
 * @api public
 */

function compatibleConstructor(thrown, errorLike) {
  if (errorLike instanceof Error) {
    // If `errorLike` is an instance of any error we compare their constructors
    return thrown.constructor === errorLike.constructor || thrown instanceof errorLike.constructor;
  } else if (errorLike.prototype instanceof Error || errorLike === Error) {
    // If `errorLike` is a constructor that inherits from Error, we compare `thrown` to `errorLike` directly
    return thrown.constructor === errorLike || thrown instanceof errorLike;
  }

  return false;
}

/**
 * ### .compatibleMessage(thrown, errMatcher)
 *
 * Checks if an error's message is compatible with a matcher (String or RegExp).
 * If the message contains the String or passes the RegExp test,
 * it is considered compatible.
 *
 * @name compatibleMessage
 * @param {Error} thrown error
 * @param {String|RegExp} errMatcher to look for into the message
 * @namespace Utils
 * @api public
 */

function compatibleMessage(thrown, errMatcher) {
  var comparisonString = typeof thrown === 'string' ? thrown : thrown.message;
  if (errMatcher instanceof RegExp) {
    return errMatcher.test(comparisonString);
  } else if (typeof errMatcher === 'string') {
    return comparisonString.indexOf(errMatcher) !== -1; // eslint-disable-line no-magic-numbers
  }

  return false;
}

/**
 * ### .getFunctionName(constructorFn)
 *
 * Returns the name of a function.
 * This also includes a polyfill function if `constructorFn.name` is not defined.
 *
 * @name getFunctionName
 * @param {Function} constructorFn
 * @namespace Utils
 * @api private
 */

var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\(\/]+)/;
function getFunctionName(constructorFn) {
  var name = '';
  if (typeof constructorFn.name === 'undefined') {
    // Here we run a polyfill if constructorFn.name is not defined
    var match = String(constructorFn).match(functionNameMatch);
    if (match) {
      name = match[1];
    }
  } else {
    name = constructorFn.name;
  }

  return name;
}

/**
 * ### .getConstructorName(errorLike)
 *
 * Gets the constructor name for an Error instance or constructor itself.
 *
 * @name getConstructorName
 * @param {Error|ErrorConstructor} errorLike
 * @namespace Utils
 * @api public
 */

function getConstructorName(errorLike) {
  var constructorName = errorLike;
  if (errorLike instanceof Error) {
    constructorName = getFunctionName(errorLike.constructor);
  } else if (typeof errorLike === 'function') {
    // If `err` is not an instance of Error it is an error constructor itself or another function.
    // If we've got a common function we get its name, otherwise we may need to create a new instance
    // of the error just in case it's a poorly-constructed error. Please see chaijs/chai/issues/45 to know more.
    constructorName = getFunctionName(errorLike).trim() ||
        getFunctionName(new errorLike()); // eslint-disable-line new-cap
  }

  return constructorName;
}

/**
 * ### .getMessage(errorLike)
 *
 * Gets the error message from an error.
 * If `err` is a String itself, we return it.
 * If the error has no message, we return an empty string.
 *
 * @name getMessage
 * @param {Error|String} errorLike
 * @namespace Utils
 * @api public
 */

function getMessage(errorLike) {
  var msg = '';
  if (errorLike && errorLike.message) {
    msg = errorLike.message;
  } else if (typeof errorLike === 'string') {
    msg = errorLike;
  }

  return msg;
}

module.exports = {
  compatibleInstance: compatibleInstance,
  compatibleConstructor: compatibleConstructor,
  compatibleMessage: compatibleMessage,
  getMessage: getMessage,
  getConstructorName: getConstructorName,
};


/***/ }),

/***/ "../../node_modules/deep-eql/index.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


/* globals Symbol: false, Uint8Array: false, WeakMap: false */
/*!
 * deep-eql
 * Copyright(c) 2013 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var type = __webpack_require__("../../node_modules/type-detect/type-detect.js");
function FakeMap() {
  this._key = 'chai/deep-eql__' + Math.random() + Date.now();
}

FakeMap.prototype = {
  get: function getMap(key) {
    return key[this._key];
  },
  set: function setMap(key, value) {
    if (Object.isExtensible(key)) {
      Object.defineProperty(key, this._key, {
        value: value,
        configurable: true,
      });
    }
  },
};

var MemoizeMap = typeof WeakMap === 'function' ? WeakMap : FakeMap;
/*!
 * Check to see if the MemoizeMap has recorded a result of the two operands
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {MemoizeMap} memoizeMap
 * @returns {Boolean|null} result
*/
function memoizeCompare(leftHandOperand, rightHandOperand, memoizeMap) {
  // Technically, WeakMap keys can *only* be objects, not primitives.
  if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return null;
  }
  var leftHandMap = memoizeMap.get(leftHandOperand);
  if (leftHandMap) {
    var result = leftHandMap.get(rightHandOperand);
    if (typeof result === 'boolean') {
      return result;
    }
  }
  return null;
}

/*!
 * Set the result of the equality into the MemoizeMap
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {MemoizeMap} memoizeMap
 * @param {Boolean} result
*/
function memoizeSet(leftHandOperand, rightHandOperand, memoizeMap, result) {
  // Technically, WeakMap keys can *only* be objects, not primitives.
  if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return;
  }
  var leftHandMap = memoizeMap.get(leftHandOperand);
  if (leftHandMap) {
    leftHandMap.set(rightHandOperand, result);
  } else {
    leftHandMap = new MemoizeMap();
    leftHandMap.set(rightHandOperand, result);
    memoizeMap.set(leftHandOperand, leftHandMap);
  }
}

/*!
 * Primary Export
 */

module.exports = deepEqual;
module.exports.MemoizeMap = MemoizeMap;

/**
 * Assert deeply nested sameValue equality between two objects of any type.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (optional) Additional options
 * @param {Array} [options.comparator] (optional) Override default algorithm, determining custom equality.
 * @param {Array} [options.memoize] (optional) Provide a custom memoization object which will cache the results of
    complex objects for a speed boost. By passing `false` you can disable memoization, but this will cause circular
    references to blow the stack.
 * @return {Boolean} equal match
 */
function deepEqual(leftHandOperand, rightHandOperand, options) {
  // If we have a comparator, we can't assume anything; so bail to its check first.
  if (options && options.comparator) {
    return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
  }

  var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
  if (simpleResult !== null) {
    return simpleResult;
  }

  // Deeper comparisons are pushed through to a larger function
  return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
}

/**
 * Many comparisons can be canceled out early via simple equality or primitive checks.
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @return {Boolean|null} equal match
 */
function simpleEqual(leftHandOperand, rightHandOperand) {
  // Equal references (except for Numbers) can be returned early
  if (leftHandOperand === rightHandOperand) {
    // Handle +-0 cases
    return leftHandOperand !== 0 || 1 / leftHandOperand === 1 / rightHandOperand;
  }

  // handle NaN cases
  if (
    leftHandOperand !== leftHandOperand && // eslint-disable-line no-self-compare
    rightHandOperand !== rightHandOperand // eslint-disable-line no-self-compare
  ) {
    return true;
  }

  // Anything that is not an 'object', i.e. symbols, functions, booleans, numbers,
  // strings, and undefined, can be compared by reference.
  if (isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    // Easy out b/c it would have passed the first equality check
    return false;
  }
  return null;
}

/*!
 * The main logic of the `deepEqual` function.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (optional) Additional options
 * @param {Array} [options.comparator] (optional) Override default algorithm, determining custom equality.
 * @param {Array} [options.memoize] (optional) Provide a custom memoization object which will cache the results of
    complex objects for a speed boost. By passing `false` you can disable memoization, but this will cause circular
    references to blow the stack.
 * @return {Boolean} equal match
*/
function extensiveDeepEqual(leftHandOperand, rightHandOperand, options) {
  options = options || {};
  options.memoize = options.memoize === false ? false : options.memoize || new MemoizeMap();
  var comparator = options && options.comparator;

  // Check if a memoized result exists.
  var memoizeResultLeft = memoizeCompare(leftHandOperand, rightHandOperand, options.memoize);
  if (memoizeResultLeft !== null) {
    return memoizeResultLeft;
  }
  var memoizeResultRight = memoizeCompare(rightHandOperand, leftHandOperand, options.memoize);
  if (memoizeResultRight !== null) {
    return memoizeResultRight;
  }

  // If a comparator is present, use it.
  if (comparator) {
    var comparatorResult = comparator(leftHandOperand, rightHandOperand);
    // Comparators may return null, in which case we want to go back to default behavior.
    if (comparatorResult === false || comparatorResult === true) {
      memoizeSet(leftHandOperand, rightHandOperand, options.memoize, comparatorResult);
      return comparatorResult;
    }
    // To allow comparators to override *any* behavior, we ran them first. Since it didn't decide
    // what to do, we need to make sure to return the basic tests first before we move on.
    var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
    if (simpleResult !== null) {
      // Don't memoize this, it takes longer to set/retrieve than to just compare.
      return simpleResult;
    }
  }

  var leftHandType = type(leftHandOperand);
  if (leftHandType !== type(rightHandOperand)) {
    memoizeSet(leftHandOperand, rightHandOperand, options.memoize, false);
    return false;
  }

  // Temporarily set the operands in the memoize object to prevent blowing the stack
  memoizeSet(leftHandOperand, rightHandOperand, options.memoize, true);

  var result = extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options);
  memoizeSet(leftHandOperand, rightHandOperand, options.memoize, result);
  return result;
}

function extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options) {
  switch (leftHandType) {
    case 'String':
    case 'Number':
    case 'Boolean':
    case 'Date':
      // If these types are their instance types (e.g. `new Number`) then re-deepEqual against their values
      return deepEqual(leftHandOperand.valueOf(), rightHandOperand.valueOf());
    case 'Promise':
    case 'Symbol':
    case 'function':
    case 'WeakMap':
    case 'WeakSet':
    case 'Error':
      return leftHandOperand === rightHandOperand;
    case 'Arguments':
    case 'Int8Array':
    case 'Uint8Array':
    case 'Uint8ClampedArray':
    case 'Int16Array':
    case 'Uint16Array':
    case 'Int32Array':
    case 'Uint32Array':
    case 'Float32Array':
    case 'Float64Array':
    case 'Array':
      return iterableEqual(leftHandOperand, rightHandOperand, options);
    case 'RegExp':
      return regexpEqual(leftHandOperand, rightHandOperand);
    case 'Generator':
      return generatorEqual(leftHandOperand, rightHandOperand, options);
    case 'DataView':
      return iterableEqual(new Uint8Array(leftHandOperand.buffer), new Uint8Array(rightHandOperand.buffer), options);
    case 'ArrayBuffer':
      return iterableEqual(new Uint8Array(leftHandOperand), new Uint8Array(rightHandOperand), options);
    case 'Set':
      return entriesEqual(leftHandOperand, rightHandOperand, options);
    case 'Map':
      return entriesEqual(leftHandOperand, rightHandOperand, options);
    default:
      return objectEqual(leftHandOperand, rightHandOperand, options);
  }
}

/*!
 * Compare two Regular Expressions for equality.
 *
 * @param {RegExp} leftHandOperand
 * @param {RegExp} rightHandOperand
 * @return {Boolean} result
 */

function regexpEqual(leftHandOperand, rightHandOperand) {
  return leftHandOperand.toString() === rightHandOperand.toString();
}

/*!
 * Compare two Sets/Maps for equality. Faster than other equality functions.
 *
 * @param {Set} leftHandOperand
 * @param {Set} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function entriesEqual(leftHandOperand, rightHandOperand, options) {
  // IE11 doesn't support Set#entries or Set#@@iterator, so we need manually populate using Set#forEach
  if (leftHandOperand.size !== rightHandOperand.size) {
    return false;
  }
  if (leftHandOperand.size === 0) {
    return true;
  }
  var leftHandItems = [];
  var rightHandItems = [];
  leftHandOperand.forEach(function gatherEntries(key, value) {
    leftHandItems.push([ key, value ]);
  });
  rightHandOperand.forEach(function gatherEntries(key, value) {
    rightHandItems.push([ key, value ]);
  });
  return iterableEqual(leftHandItems.sort(), rightHandItems.sort(), options);
}

/*!
 * Simple equality for flat iterable objects such as Arrays, TypedArrays or Node.js buffers.
 *
 * @param {Iterable} leftHandOperand
 * @param {Iterable} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function iterableEqual(leftHandOperand, rightHandOperand, options) {
  var length = leftHandOperand.length;
  if (length !== rightHandOperand.length) {
    return false;
  }
  if (length === 0) {
    return true;
  }
  var index = -1;
  while (++index < length) {
    if (deepEqual(leftHandOperand[index], rightHandOperand[index], options) === false) {
      return false;
    }
  }
  return true;
}

/*!
 * Simple equality for generator objects such as those returned by generator functions.
 *
 * @param {Iterable} leftHandOperand
 * @param {Iterable} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function generatorEqual(leftHandOperand, rightHandOperand, options) {
  return iterableEqual(getGeneratorEntries(leftHandOperand), getGeneratorEntries(rightHandOperand), options);
}

/*!
 * Determine if the given object has an @@iterator function.
 *
 * @param {Object} target
 * @return {Boolean} `true` if the object has an @@iterator function.
 */
function hasIteratorFunction(target) {
  return typeof Symbol !== 'undefined' &&
    typeof target === 'object' &&
    typeof Symbol.iterator !== 'undefined' &&
    typeof target[Symbol.iterator] === 'function';
}

/*!
 * Gets all iterator entries from the given Object. If the Object has no @@iterator function, returns an empty array.
 * This will consume the iterator - which could have side effects depending on the @@iterator implementation.
 *
 * @param {Object} target
 * @returns {Array} an array of entries from the @@iterator function
 */
function getIteratorEntries(target) {
  if (hasIteratorFunction(target)) {
    try {
      return getGeneratorEntries(target[Symbol.iterator]());
    } catch (iteratorError) {
      return [];
    }
  }
  return [];
}

/*!
 * Gets all entries from a Generator. This will consume the generator - which could have side effects.
 *
 * @param {Generator} target
 * @returns {Array} an array of entries from the Generator.
 */
function getGeneratorEntries(generator) {
  var generatorResult = generator.next();
  var accumulator = [ generatorResult.value ];
  while (generatorResult.done === false) {
    generatorResult = generator.next();
    accumulator.push(generatorResult.value);
  }
  return accumulator;
}

/*!
 * Gets all own and inherited enumerable keys from a target.
 *
 * @param {Object} target
 * @returns {Array} an array of own and inherited enumerable keys from the target.
 */
function getEnumerableKeys(target) {
  var keys = [];
  for (var key in target) {
    keys.push(key);
  }
  return keys;
}

/*!
 * Determines if two objects have matching values, given a set of keys. Defers to deepEqual for the equality check of
 * each key. If any value of the given key is not equal, the function will return false (early).
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Array} keys An array of keys to compare the values of leftHandOperand and rightHandOperand against
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
function keysEqual(leftHandOperand, rightHandOperand, keys, options) {
  var length = keys.length;
  if (length === 0) {
    return true;
  }
  for (var i = 0; i < length; i += 1) {
    if (deepEqual(leftHandOperand[keys[i]], rightHandOperand[keys[i]], options) === false) {
      return false;
    }
  }
  return true;
}

/*!
 * Recursively check the equality of two Objects. Once basic sameness has been established it will defer to `deepEqual`
 * for each enumerable key in the object.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function objectEqual(leftHandOperand, rightHandOperand, options) {
  var leftHandKeys = getEnumerableKeys(leftHandOperand);
  var rightHandKeys = getEnumerableKeys(rightHandOperand);
  if (leftHandKeys.length && leftHandKeys.length === rightHandKeys.length) {
    leftHandKeys.sort();
    rightHandKeys.sort();
    if (iterableEqual(leftHandKeys, rightHandKeys) === false) {
      return false;
    }
    return keysEqual(leftHandOperand, rightHandOperand, leftHandKeys, options);
  }

  var leftHandEntries = getIteratorEntries(leftHandOperand);
  var rightHandEntries = getIteratorEntries(rightHandOperand);
  if (leftHandEntries.length && leftHandEntries.length === rightHandEntries.length) {
    leftHandEntries.sort();
    rightHandEntries.sort();
    return iterableEqual(leftHandEntries, rightHandEntries, options);
  }

  if (leftHandKeys.length === 0 &&
      leftHandEntries.length === 0 &&
      rightHandKeys.length === 0 &&
      rightHandEntries.length === 0) {
    return true;
  }

  return false;
}

/*!
 * Returns true if the argument is a primitive.
 *
 * This intentionally returns true for all objects that can be compared by reference,
 * including functions and symbols.
 *
 * @param {Mixed} value
 * @return {Boolean} result
 */
function isPrimitive(value) {
  return value === null || typeof value !== 'object';
}


/***/ }),

/***/ "../../node_modules/events/events.js":
/***/ ((module) => {

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}


/***/ }),

/***/ "../../node_modules/functional-red-black-tree/rbtree.js":
/***/ ((module) => {



module.exports = createRBTree

var RED   = 0
var BLACK = 1

function RBNode(color, key, value, left, right, count) {
  this._color = color
  this.key = key
  this.value = value
  this.left = left
  this.right = right
  this._count = count
}

function cloneNode(node) {
  return new RBNode(node._color, node.key, node.value, node.left, node.right, node._count)
}

function repaint(color, node) {
  return new RBNode(color, node.key, node.value, node.left, node.right, node._count)
}

function recount(node) {
  node._count = 1 + (node.left ? node.left._count : 0) + (node.right ? node.right._count : 0)
}

function RedBlackTree(compare, root) {
  this._compare = compare
  this.root = root
}

var proto = RedBlackTree.prototype

Object.defineProperty(proto, "keys", {
  get: function() {
    var result = []
    this.forEach(function(k,v) {
      result.push(k)
    })
    return result
  }
})

Object.defineProperty(proto, "values", {
  get: function() {
    var result = []
    this.forEach(function(k,v) {
      result.push(v)
    })
    return result
  }
})

//Returns the number of nodes in the tree
Object.defineProperty(proto, "length", {
  get: function() {
    if(this.root) {
      return this.root._count
    }
    return 0
  }
})

//Insert a new item into the tree
proto.insert = function(key, value) {
  var cmp = this._compare
  //Find point to insert new node at
  var n = this.root
  var n_stack = []
  var d_stack = []
  while(n) {
    var d = cmp(key, n.key)
    n_stack.push(n)
    d_stack.push(d)
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  //Rebuild path to leaf node
  n_stack.push(new RBNode(RED, key, value, null, null, 1))
  for(var s=n_stack.length-2; s>=0; --s) {
    var n = n_stack[s]
    if(d_stack[s] <= 0) {
      n_stack[s] = new RBNode(n._color, n.key, n.value, n_stack[s+1], n.right, n._count+1)
    } else {
      n_stack[s] = new RBNode(n._color, n.key, n.value, n.left, n_stack[s+1], n._count+1)
    }
  }
  //Rebalance tree using rotations
  //console.log("start insert", key, d_stack)
  for(var s=n_stack.length-1; s>1; --s) {
    var p = n_stack[s-1]
    var n = n_stack[s]
    if(p._color === BLACK || n._color === BLACK) {
      break
    }
    var pp = n_stack[s-2]
    if(pp.left === p) {
      if(p.left === n) {
        var y = pp.right
        if(y && y._color === RED) {
          //console.log("LLr")
          p._color = BLACK
          pp.right = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("LLb")
          pp._color = RED
          pp.left = p.right
          p._color = BLACK
          p.right = pp
          n_stack[s-2] = p
          n_stack[s-1] = n
          recount(pp)
          recount(p)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.left === pp) {
              ppp.left = p
            } else {
              ppp.right = p
            }
          }
          break
        }
      } else {
        var y = pp.right
        if(y && y._color === RED) {
          //console.log("LRr")
          p._color = BLACK
          pp.right = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("LRb")
          p.right = n.left
          pp._color = RED
          pp.left = n.right
          n._color = BLACK
          n.left = p
          n.right = pp
          n_stack[s-2] = n
          n_stack[s-1] = p
          recount(pp)
          recount(p)
          recount(n)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.left === pp) {
              ppp.left = n
            } else {
              ppp.right = n
            }
          }
          break
        }
      }
    } else {
      if(p.right === n) {
        var y = pp.left
        if(y && y._color === RED) {
          //console.log("RRr", y.key)
          p._color = BLACK
          pp.left = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("RRb")
          pp._color = RED
          pp.right = p.left
          p._color = BLACK
          p.left = pp
          n_stack[s-2] = p
          n_stack[s-1] = n
          recount(pp)
          recount(p)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.right === pp) {
              ppp.right = p
            } else {
              ppp.left = p
            }
          }
          break
        }
      } else {
        var y = pp.left
        if(y && y._color === RED) {
          //console.log("RLr")
          p._color = BLACK
          pp.left = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("RLb")
          p.left = n.right
          pp._color = RED
          pp.right = n.left
          n._color = BLACK
          n.right = p
          n.left = pp
          n_stack[s-2] = n
          n_stack[s-1] = p
          recount(pp)
          recount(p)
          recount(n)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.right === pp) {
              ppp.right = n
            } else {
              ppp.left = n
            }
          }
          break
        }
      }
    }
  }
  //Return new tree
  n_stack[0]._color = BLACK
  return new RedBlackTree(cmp, n_stack[0])
}


//Visit all nodes inorder
function doVisitFull(visit, node) {
  if(node.left) {
    var v = doVisitFull(visit, node.left)
    if(v) { return v }
  }
  var v = visit(node.key, node.value)
  if(v) { return v }
  if(node.right) {
    return doVisitFull(visit, node.right)
  }
}

//Visit half nodes in order
function doVisitHalf(lo, compare, visit, node) {
  var l = compare(lo, node.key)
  if(l <= 0) {
    if(node.left) {
      var v = doVisitHalf(lo, compare, visit, node.left)
      if(v) { return v }
    }
    var v = visit(node.key, node.value)
    if(v) { return v }
  }
  if(node.right) {
    return doVisitHalf(lo, compare, visit, node.right)
  }
}

//Visit all nodes within a range
function doVisit(lo, hi, compare, visit, node) {
  var l = compare(lo, node.key)
  var h = compare(hi, node.key)
  var v
  if(l <= 0) {
    if(node.left) {
      v = doVisit(lo, hi, compare, visit, node.left)
      if(v) { return v }
    }
    if(h > 0) {
      v = visit(node.key, node.value)
      if(v) { return v }
    }
  }
  if(h > 0 && node.right) {
    return doVisit(lo, hi, compare, visit, node.right)
  }
}


proto.forEach = function rbTreeForEach(visit, lo, hi) {
  if(!this.root) {
    return
  }
  switch(arguments.length) {
    case 1:
      return doVisitFull(visit, this.root)
    break

    case 2:
      return doVisitHalf(lo, this._compare, visit, this.root)
    break

    case 3:
      if(this._compare(lo, hi) >= 0) {
        return
      }
      return doVisit(lo, hi, this._compare, visit, this.root)
    break
  }
}

//First item in list
Object.defineProperty(proto, "begin", {
  get: function() {
    var stack = []
    var n = this.root
    while(n) {
      stack.push(n)
      n = n.left
    }
    return new RedBlackTreeIterator(this, stack)
  }
})

//Last item in list
Object.defineProperty(proto, "end", {
  get: function() {
    var stack = []
    var n = this.root
    while(n) {
      stack.push(n)
      n = n.right
    }
    return new RedBlackTreeIterator(this, stack)
  }
})

//Find the ith item in the tree
proto.at = function(idx) {
  if(idx < 0) {
    return new RedBlackTreeIterator(this, [])
  }
  var n = this.root
  var stack = []
  while(true) {
    stack.push(n)
    if(n.left) {
      if(idx < n.left._count) {
        n = n.left
        continue
      }
      idx -= n.left._count
    }
    if(!idx) {
      return new RedBlackTreeIterator(this, stack)
    }
    idx -= 1
    if(n.right) {
      if(idx >= n.right._count) {
        break
      }
      n = n.right
    } else {
      break
    }
  }
  return new RedBlackTreeIterator(this, [])
}

proto.ge = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d <= 0) {
      last_ptr = stack.length
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

proto.gt = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d < 0) {
      last_ptr = stack.length
    }
    if(d < 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

proto.lt = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d > 0) {
      last_ptr = stack.length
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

proto.le = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d >= 0) {
      last_ptr = stack.length
    }
    if(d < 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

//Finds the item with key if it exists
proto.find = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d === 0) {
      return new RedBlackTreeIterator(this, stack)
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  return new RedBlackTreeIterator(this, [])
}

//Removes item with key from tree
proto.remove = function(key) {
  var iter = this.find(key)
  if(iter) {
    return iter.remove()
  }
  return this
}

//Returns the item at `key`
proto.get = function(key) {
  var cmp = this._compare
  var n = this.root
  while(n) {
    var d = cmp(key, n.key)
    if(d === 0) {
      return n.value
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  return
}

//Iterator for red black tree
function RedBlackTreeIterator(tree, stack) {
  this.tree = tree
  this._stack = stack
}

var iproto = RedBlackTreeIterator.prototype

//Test if iterator is valid
Object.defineProperty(iproto, "valid", {
  get: function() {
    return this._stack.length > 0
  }
})

//Node of the iterator
Object.defineProperty(iproto, "node", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1]
    }
    return null
  },
  enumerable: true
})

//Makes a copy of an iterator
iproto.clone = function() {
  return new RedBlackTreeIterator(this.tree, this._stack.slice())
}

//Swaps two nodes
function swapNode(n, v) {
  n.key = v.key
  n.value = v.value
  n.left = v.left
  n.right = v.right
  n._color = v._color
  n._count = v._count
}

//Fix up a double black node in a tree
function fixDoubleBlack(stack) {
  var n, p, s, z
  for(var i=stack.length-1; i>=0; --i) {
    n = stack[i]
    if(i === 0) {
      n._color = BLACK
      return
    }
    //console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
    p = stack[i-1]
    if(p.left === n) {
      //console.log("left child")
      s = p.right
      if(s.right && s.right._color === RED) {
        //console.log("case 1: right sibling child red")
        s = p.right = cloneNode(s)
        z = s.right = cloneNode(s.right)
        p.right = s.left
        s.left = p
        s.right = z
        s._color = p._color
        n._color = BLACK
        p._color = BLACK
        z._color = BLACK
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.left === p) {
            pp.left = s
          } else {
            pp.right = s
          }
        }
        stack[i-1] = s
        return
      } else if(s.left && s.left._color === RED) {
        //console.log("case 1: left sibling child red")
        s = p.right = cloneNode(s)
        z = s.left = cloneNode(s.left)
        p.right = z.left
        s.left = z.right
        z.left = p
        z.right = s
        z._color = p._color
        p._color = BLACK
        s._color = BLACK
        n._color = BLACK
        recount(p)
        recount(s)
        recount(z)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.left === p) {
            pp.left = z
          } else {
            pp.right = z
          }
        }
        stack[i-1] = z
        return
      }
      if(s._color === BLACK) {
        if(p._color === RED) {
          //console.log("case 2: black sibling, red parent", p.right.value)
          p._color = BLACK
          p.right = repaint(RED, s)
          return
        } else {
          //console.log("case 2: black sibling, black parent", p.right.value)
          p.right = repaint(RED, s)
          continue  
        }
      } else {
        //console.log("case 3: red sibling")
        s = cloneNode(s)
        p.right = s.left
        s.left = p
        s._color = p._color
        p._color = RED
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.left === p) {
            pp.left = s
          } else {
            pp.right = s
          }
        }
        stack[i-1] = s
        stack[i] = p
        if(i+1 < stack.length) {
          stack[i+1] = n
        } else {
          stack.push(n)
        }
        i = i+2
      }
    } else {
      //console.log("right child")
      s = p.left
      if(s.left && s.left._color === RED) {
        //console.log("case 1: left sibling child red", p.value, p._color)
        s = p.left = cloneNode(s)
        z = s.left = cloneNode(s.left)
        p.left = s.right
        s.right = p
        s.left = z
        s._color = p._color
        n._color = BLACK
        p._color = BLACK
        z._color = BLACK
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.right === p) {
            pp.right = s
          } else {
            pp.left = s
          }
        }
        stack[i-1] = s
        return
      } else if(s.right && s.right._color === RED) {
        //console.log("case 1: right sibling child red")
        s = p.left = cloneNode(s)
        z = s.right = cloneNode(s.right)
        p.left = z.right
        s.right = z.left
        z.right = p
        z.left = s
        z._color = p._color
        p._color = BLACK
        s._color = BLACK
        n._color = BLACK
        recount(p)
        recount(s)
        recount(z)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.right === p) {
            pp.right = z
          } else {
            pp.left = z
          }
        }
        stack[i-1] = z
        return
      }
      if(s._color === BLACK) {
        if(p._color === RED) {
          //console.log("case 2: black sibling, red parent")
          p._color = BLACK
          p.left = repaint(RED, s)
          return
        } else {
          //console.log("case 2: black sibling, black parent")
          p.left = repaint(RED, s)
          continue  
        }
      } else {
        //console.log("case 3: red sibling")
        s = cloneNode(s)
        p.left = s.right
        s.right = p
        s._color = p._color
        p._color = RED
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.right === p) {
            pp.right = s
          } else {
            pp.left = s
          }
        }
        stack[i-1] = s
        stack[i] = p
        if(i+1 < stack.length) {
          stack[i+1] = n
        } else {
          stack.push(n)
        }
        i = i+2
      }
    }
  }
}

//Removes item at iterator from tree
iproto.remove = function() {
  var stack = this._stack
  if(stack.length === 0) {
    return this.tree
  }
  //First copy path to node
  var cstack = new Array(stack.length)
  var n = stack[stack.length-1]
  cstack[cstack.length-1] = new RBNode(n._color, n.key, n.value, n.left, n.right, n._count)
  for(var i=stack.length-2; i>=0; --i) {
    var n = stack[i]
    if(n.left === stack[i+1]) {
      cstack[i] = new RBNode(n._color, n.key, n.value, cstack[i+1], n.right, n._count)
    } else {
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count)
    }
  }

  //Get node
  n = cstack[cstack.length-1]
  //console.log("start remove: ", n.value)

  //If not leaf, then swap with previous node
  if(n.left && n.right) {
    //console.log("moving to leaf")

    //First walk to previous leaf
    var split = cstack.length
    n = n.left
    while(n.right) {
      cstack.push(n)
      n = n.right
    }
    //Copy path to leaf
    var v = cstack[split-1]
    cstack.push(new RBNode(n._color, v.key, v.value, n.left, n.right, n._count))
    cstack[split-1].key = n.key
    cstack[split-1].value = n.value

    //Fix up stack
    for(var i=cstack.length-2; i>=split; --i) {
      n = cstack[i]
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count)
    }
    cstack[split-1].left = cstack[split]
  }
  //console.log("stack=", cstack.map(function(v) { return v.value }))

  //Remove leaf node
  n = cstack[cstack.length-1]
  if(n._color === RED) {
    //Easy case: removing red leaf
    //console.log("RED leaf")
    var p = cstack[cstack.length-2]
    if(p.left === n) {
      p.left = null
    } else if(p.right === n) {
      p.right = null
    }
    cstack.pop()
    for(var i=0; i<cstack.length; ++i) {
      cstack[i]._count--
    }
    return new RedBlackTree(this.tree._compare, cstack[0])
  } else {
    if(n.left || n.right) {
      //Second easy case:  Single child black parent
      //console.log("BLACK single child")
      if(n.left) {
        swapNode(n, n.left)
      } else if(n.right) {
        swapNode(n, n.right)
      }
      //Child must be red, so repaint it black to balance color
      n._color = BLACK
      for(var i=0; i<cstack.length-1; ++i) {
        cstack[i]._count--
      }
      return new RedBlackTree(this.tree._compare, cstack[0])
    } else if(cstack.length === 1) {
      //Third easy case: root
      //console.log("ROOT")
      return new RedBlackTree(this.tree._compare, null)
    } else {
      //Hard case: Repaint n, and then do some nasty stuff
      //console.log("BLACK leaf no children")
      for(var i=0; i<cstack.length; ++i) {
        cstack[i]._count--
      }
      var parent = cstack[cstack.length-2]
      fixDoubleBlack(cstack)
      //Fix up links
      if(parent.left === n) {
        parent.left = null
      } else {
        parent.right = null
      }
    }
  }
  return new RedBlackTree(this.tree._compare, cstack[0])
}

//Returns key
Object.defineProperty(iproto, "key", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1].key
    }
    return
  },
  enumerable: true
})

//Returns value
Object.defineProperty(iproto, "value", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1].value
    }
    return
  },
  enumerable: true
})


//Returns the position of this iterator in the sorted list
Object.defineProperty(iproto, "index", {
  get: function() {
    var idx = 0
    var stack = this._stack
    if(stack.length === 0) {
      var r = this.tree.root
      if(r) {
        return r._count
      }
      return 0
    } else if(stack[stack.length-1].left) {
      idx = stack[stack.length-1].left._count
    }
    for(var s=stack.length-2; s>=0; --s) {
      if(stack[s+1] === stack[s].right) {
        ++idx
        if(stack[s].left) {
          idx += stack[s].left._count
        }
      }
    }
    return idx
  },
  enumerable: true
})

//Advances iterator to next element in list
iproto.next = function() {
  var stack = this._stack
  if(stack.length === 0) {
    return
  }
  var n = stack[stack.length-1]
  if(n.right) {
    n = n.right
    while(n) {
      stack.push(n)
      n = n.left
    }
  } else {
    stack.pop()
    while(stack.length > 0 && stack[stack.length-1].right === n) {
      n = stack[stack.length-1]
      stack.pop()
    }
  }
}

//Checks if iterator is at end of tree
Object.defineProperty(iproto, "hasNext", {
  get: function() {
    var stack = this._stack
    if(stack.length === 0) {
      return false
    }
    if(stack[stack.length-1].right) {
      return true
    }
    for(var s=stack.length-1; s>0; --s) {
      if(stack[s-1].left === stack[s]) {
        return true
      }
    }
    return false
  }
})

//Update value
iproto.update = function(value) {
  var stack = this._stack
  if(stack.length === 0) {
    throw new Error("Can't update empty node!")
  }
  var cstack = new Array(stack.length)
  var n = stack[stack.length-1]
  cstack[cstack.length-1] = new RBNode(n._color, n.key, value, n.left, n.right, n._count)
  for(var i=stack.length-2; i>=0; --i) {
    n = stack[i]
    if(n.left === stack[i+1]) {
      cstack[i] = new RBNode(n._color, n.key, n.value, cstack[i+1], n.right, n._count)
    } else {
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count)
    }
  }
  return new RedBlackTree(this.tree._compare, cstack[0])
}

//Moves iterator backward one element
iproto.prev = function() {
  var stack = this._stack
  if(stack.length === 0) {
    return
  }
  var n = stack[stack.length-1]
  if(n.left) {
    n = n.left
    while(n) {
      stack.push(n)
      n = n.right
    }
  } else {
    stack.pop()
    while(stack.length > 0 && stack[stack.length-1].left === n) {
      n = stack[stack.length-1]
      stack.pop()
    }
  }
}

//Checks if iterator is at start of tree
Object.defineProperty(iproto, "hasPrev", {
  get: function() {
    var stack = this._stack
    if(stack.length === 0) {
      return false
    }
    if(stack[stack.length-1].left) {
      return true
    }
    for(var s=stack.length-1; s>0; --s) {
      if(stack[s-1].right === stack[s]) {
        return true
      }
    }
    return false
  }
})

//Default comparison function
function defaultCompare(a, b) {
  if(a < b) {
    return -1
  }
  if(a > b) {
    return 1
  }
  return 0
}

//Build a tree
function createRBTree(compare) {
  return new RedBlackTree(compare || defaultCompare, null)
}

/***/ }),

/***/ "../../node_modules/get-func-name/index.js":
/***/ ((module) => {



/* !
 * Chai - getFuncName utility
 * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getFuncName(constructorFn)
 *
 * Returns the name of a function.
 * When a non-function instance is passed, returns `null`.
 * This also includes a polyfill function if `aFunc.name` is not defined.
 *
 * @name getFuncName
 * @param {Function} funct
 * @namespace Utils
 * @api public
 */

var toString = Function.prototype.toString;
var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\s\(\/]+)/;
function getFuncName(aFunc) {
  if (typeof aFunc !== 'function') {
    return null;
  }

  var name = '';
  if (typeof Function.prototype.name === 'undefined' && typeof aFunc.name === 'undefined') {
    // Here we run a polyfill if Function does not support the `name` property and if aFunc.name is not defined
    var match = toString.call(aFunc).match(functionNameMatch);
    if (match) {
      name = match[1];
    }
  } else {
    // If we've got a `name` property we just use it
    name = aFunc.name;
  }

  return name;
}

module.exports = getFuncName;


/***/ }),

/***/ "../../node_modules/ieee754/index.js":
/***/ ((__unused_webpack_module, exports) => {

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}


/***/ }),

/***/ "../../node_modules/js-sorted-set/sorted-set.js":
/***/ (function(module) {

(function (global, factory) {
   true ? module.exports = factory() :
  0;
}(this, (function () { 'use strict';

  class AbstractSortedSet {
    constructor(options) {
      if ((options != null ? options.strategy : void 0) == null) {
        throw 'Must pass options.strategy, a strategy';
      }

      if ((options != null ? options.comparator : void 0) == null) {
        throw 'Must pass options.comparator, a comparator';
      }

      if ((options != null ? options.onInsertConflict : void 0) == null) {
        throw 'Must pass options.onInsertConflict, a function';
      }

      this.priv = new options.strategy(options);
      this.length = 0;
    }

    insert(value) {
      this.priv.insert(value);
      this.length += 1;
      return this;
    }

    remove(value) {
      this.priv.remove(value);
      this.length -= 1;
      return this;
    }

    clear() {
      this.priv.clear();
      this.length = 0;
      return this;
    }

    contains(value) {
      return this.priv.contains(value);
    } // Returns this set as an Array


    toArray() {
      return this.priv.toArray();
    }

    forEach(callback, thisArg) {
      this.priv.forEachImpl(callback, this, thisArg);
      return this;
    }

    map(callback, thisArg) {
      const ret = [];
      this.forEach(function (value, index, self) {
        return ret.push(callback.call(thisArg, value, index, self));
      });
      return ret;
    }

    filter(callback, thisArg) {
      const ret = [];
      this.forEach(function (value, index, self) {
        if (callback.call(thisArg, value, index, self)) {
          return ret.push(value);
        }
      });
      return ret;
    }

    every(callback, thisArg) {
      let ret = true;
      this.forEach(function (value, index, self) {
        if (ret && !callback.call(thisArg, value, index, self)) {
          ret = false;
        }
      });
      return ret;
    }

    some(callback, thisArg) {
      let ret = false;
      this.forEach(function (value, index, self) {
        if (!ret && callback.call(thisArg, value, index, self)) {
          ret = true;
        }
      });
      return ret;
    } // An iterator is similar to a C++ iterator: it points _before_ a value.
    // So in this sorted set:
    //   | 1 | 2 | 3 | 4 | 5 |
    //   ^a      ^b          ^c
    // `a` is a pointer to the beginning of the iterator. `a.value()` returns
    // `3`. `a.previous()` returns `null`. `a.setValue()` works, if
    // `options.allowSetValue` is true.
    // `b` is a pointer to the value `3`. `a.previous()` and `a.next()` both do
    // the obvious.
    // `c` is a pointer to the `null` value. `c.previous()` works; `c.next()`
    // returns null. `c.setValue()` throws an exception, even if
    // `options.allowSetValue` is true.
    // Iterators have `hasNext()` and `hasPrevious()` methods, too.
    // Iterators are immutible. `iterator.next()` returns a new iterator.
    // Iterators become invalid as soon as `insert()` or `remove()` is called.


    findIterator(value) {
      return this.priv.findIterator(value);
    } // Finds an iterator pointing to the lowest possible value.


    beginIterator() {
      return this.priv.beginIterator();
    } // Finds an iterator pointing to the `null` value.


    endIterator() {
      return this.priv.endIterator();
    }

  }

  class Iterator {
    constructor(priv, index1) {
      this.priv = priv;
      this.index = index1;
      this.data = this.priv.data;
    }

    hasNext() {
      return this.index < this.data.length;
    }

    hasPrevious() {
      return this.index > 0;
    }

    value() {
      if (this.index < this.data.length) {
        return this.data[this.index];
      } else {
        return null;
      }
    }

    setValue(value) {
      if (!this.priv.options.allowSetValue) {
        throw 'Must set options.allowSetValue';
      }

      if (!this.hasNext()) {
        throw 'Cannot set value at end of set';
      }

      return this.data[this.index] = value;
    }

    next() {
      if (this.index >= this.data.length) {
        return null;
      } else {
        return new Iterator(this.priv, this.index + 1);
      }
    }

    previous() {
      if (this.index <= 0) {
        return null;
      } else {
        return new Iterator(this.priv, this.index - 1);
      }
    }

  }

  const binarySearchForIndex = (array, value, comparator) => {
    let low = 0;
    let high = array.length;

    while (low < high) {
      const mid = low + high >>> 1;

      if (comparator(array[mid], value) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  };

  class ArrayStrategy {
    constructor(options) {
      this.options = options;
      this.onInsertConflict = this.options.onInsertConflict;
      this.comparator = this.options.comparator;
      this.data = [];
    }

    toArray() {
      return this.data;
    }

    insert(value) {
      const index = binarySearchForIndex(this.data, value, this.comparator);

      if (this.data[index] !== void 0 && this.comparator(this.data[index], value) === 0) {
        return this.data.splice(index, 1, this.onInsertConflict(this.data[index], value));
      } else {
        return this.data.splice(index, 0, value);
      }
    }

    remove(value) {
      const index = binarySearchForIndex(this.data, value, this.comparator);

      if (this.comparator(this.data[index], value) !== 0) {
        throw 'Value not in set';
      }

      return this.data.splice(index, 1);
    }

    clear() {
      return this.data.length = 0;
    }

    contains(value) {
      const index = binarySearchForIndex(this.data, value, this.comparator);
      return this.index !== this.data.length && this.comparator(this.data[index], value) === 0;
    }

    forEachImpl(callback, sortedSet, thisArg) {
      const data = this.data;
      const len = data.length;

      for (let i = 0; i < len; i++) {
        callback.call(thisArg, data[i], i, sortedSet);
      }
    }

    findIterator(value) {
      const index = binarySearchForIndex(this.data, value, this.comparator);
      return new Iterator(this, index);
    }

    beginIterator() {
      return new Iterator(this, 0);
    }

    endIterator() {
      return new Iterator(this, this.data.length);
    }

  }

  const descendAllTheWay = (leftOrRight, node) => {
    // Assumes node._iteratorParentNode is set
    while (node[leftOrRight] !== null) {
      const parent = node;
      node = node[leftOrRight];
      node._iteratorParentNode = parent;
    }

    return node;
  };

  const moveCursor = (leftOrRight, node) => {
    let parent, rightOrLeft;

    if (node[leftOrRight] !== null) {
      parent = node;
      node = node[leftOrRight];
      node._iteratorParentNode = parent;
      rightOrLeft = leftOrRight === 'left' ? 'right' : 'left';
      node = descendAllTheWay(rightOrLeft, node);
    } else {
      while ((parent = node._iteratorParentNode) !== null && parent[leftOrRight] === node) {
        node = parent;
      }

      node = parent; // either null or the correct-direction parent
    }

    return node;
  }; // The BinaryTreeIterator actually writes to the tree: it maintains a
  // "_iteratorParentNode" variable on each node. Please ignore this.


  class BinaryTreeIterator {
    constructor(tree1, node1) {
      this.tree = tree1;
      this.node = node1;
    }

    next() {
      if (this.node === null) {
        return null;
      } else {
        const node = moveCursor('right', this.node);
        return new BinaryTreeIterator(this.tree, node);
      }
    }

    previous() {
      if (this.node === null) {
        if (this.tree.root === null) {
          return null;
        } else {
          this.tree.root._iteratorParentNode = null;
          const node = descendAllTheWay('right', this.tree.root);
          return new BinaryTreeIterator(this.tree, node);
        }
      } else {
        const node = moveCursor('left', this.node);

        if (node === null) {
          return null;
        } else {
          return new BinaryTreeIterator(this.tree, node);
        }
      }
    }

    hasNext() {
      return this.node !== null;
    }

    hasPrevious() {
      return this.previous() !== null;
    }

    value() {
      if (this.node === null) {
        return null;
      } else {
        return this.node.value;
      }
    }

    setValue(value) {
      if (!this.tree.options.allowSetValue) {
        throw 'Must set options.allowSetValue';
      }

      if (!this.hasNext()) {
        throw 'Cannot set value at end of set';
      }

      return this.node.value = value;
    }

  }

  BinaryTreeIterator.find = function (tree, value, comparator) {
    const root = tree.root;

    if (root != null) {
      root._iteratorParentNode = null;
    }

    let node = root;
    let nextNode = null; // For finding an in-between node

    while (node !== null) {
      const cmp = comparator(value, node.value);

      if (cmp === 0) {
        break;
      } else if (cmp < 0) {
        if (node.left === null) {
          break;
        }

        nextNode = node; // If we descend all right after this until there are
        // no more right nodes, we want to return an
        // "in-between" iterator ... pointing here.

        node.left._iteratorParentNode = node;
        node = node.left;
      } else {
        if (node.right !== null) {
          node.right._iteratorParentNode = node;
          node = node.right;
        } else {
          node = nextNode;
          break;
        }
      }
    }

    return new BinaryTreeIterator(tree, node);
  };

  BinaryTreeIterator.left = tree => {
    if (tree.root === null) {
      return new BinaryTreeIterator(tree, null);
    } else {
      tree.root._iteratorParentNode = null;
      const node = descendAllTheWay('left', tree.root);
      return new BinaryTreeIterator(tree, node);
    }
  };

  BinaryTreeIterator.right = tree => {
    return new BinaryTreeIterator(tree, null);
  };

  const binaryTreeTraverse = (node, callback) => {
    if (node !== null) {
      binaryTreeTraverse(node.left, callback);
      callback(node.value);
      binaryTreeTraverse(node.right, callback);
    }
  }; // An AbstractBinaryTree has a @root. @root is null or an object with
  // `.left`, `.right` and `.value` properties.


  class AbstractBinaryTree {
    toArray() {
      const ret = [];
      binaryTreeTraverse(this.root, function (value) {
        return ret.push(value);
      });
      return ret;
    }

    clear() {
      return this.root = null;
    }

    forEachImpl(callback, sortedSet, thisArg) {
      let i = 0;
      binaryTreeTraverse(this.root, function (value) {
        callback.call(thisArg, value, i, sortedSet);
        i += 1;
      });
    }

    contains(value) {
      const comparator = this.comparator;
      let node = this.root;

      while (node !== null) {
        const cmp = comparator(value, node.value);

        if (cmp === 0) {
          break;
        } else if (cmp < 0) {
          node = node.left;
        } else {
          node = node.right;
        }
      }

      return node !== null && comparator(node.value, value) === 0;
    }

    findIterator(value) {
      return BinaryTreeIterator.find(this, value, this.comparator);
    }

    beginIterator() {
      return BinaryTreeIterator.left(this);
    }

    endIterator() {
      return BinaryTreeIterator.right(this);
    }

  }

  class Node {
    constructor(value) {
      this.value = value;
      this.left = null;
      this.right = null;
    }

  }

  const nodeAllTheWay = (node, leftOrRight) => {
    while (node[leftOrRight] !== null) {
      node = node[leftOrRight];
    }

    return node;
  }; // Returns the subtree, minus value


  const binaryTreeDelete = (node, value, comparator) => {
    if (node === null) {
      throw 'Value not in set';
    }

    const cmp = comparator(value, node.value);

    if (cmp < 0) {
      node.left = binaryTreeDelete(node.left, value, comparator);
    } else if (cmp > 0) {
      node.right = binaryTreeDelete(node.right, value, comparator); // This is the value we want to remove
    } else {
      if (node.left === null && node.right === null) {
        node = null;
      } else if (node.right === null) {
        node = node.left;
      } else if (node.left === null) {
        node = node.right;
      } else {
        const nextNode = nodeAllTheWay(node.right, 'left');
        node.value = nextNode.value;
        node.right = binaryTreeDelete(node.right, nextNode.value, comparator);
      }
    }

    return node;
  };

  class BinaryTreeStrategy extends AbstractBinaryTree {
    constructor(options) {
      super();
      this.options = options;
      this.comparator = this.options.comparator;
      this.onInsertConflict = this.options.onInsertConflict;
      this.root = null;
    }

    insert(value) {
      const compare = this.comparator;

      if (this.root !== null) {
        let parent = this.root;
        let leftOrRight = null;

        while (true) {
          const cmp = compare(value, parent.value);

          if (cmp === 0) {
            parent.value = this.onInsertConflict(parent.value, value);
            return;
          } else {
            leftOrRight = cmp < 0 ? 'left' : 'right';

            if (parent[leftOrRight] === null) {
              break;
            }

            parent = parent[leftOrRight];
          }
        }

        return parent[leftOrRight] = new Node(value);
      } else {
        return this.root = new Node(value);
      }
    }

    remove(value) {
      return this.root = binaryTreeDelete(this.root, value, this.comparator);
    }

  }

  // It's copied from http://www.cs.princeton.edu/~rs/talks/LLRB/LLRB.pdf.
  // It's practically a copy-paste job, minus the semicolons. missing bits were
  // filled in with hints from
  // http://www.teachsolaisgames.com/articles/balanced_left_leaning.html
  // Here are some differences:
  // * This isn't a map structure: it's just a tree. There are no keys: the
  //   comparator applies to the values.
  // * We use the passed comparator.

  class Node$1 {
    constructor(value1) {
      this.value = value1;
      this.left = null;
      this.right = null;
      this.isRed = true; // null nodes -- leaves -- are black
    }

  }

  const rotateLeft = h => {
    const x = h.right;
    h.right = x.left;
    x.left = h;
    x.isRed = h.isRed;
    h.isRed = true;
    return x;
  };

  const rotateRight = h => {
    const x = h.left;
    h.left = x.right;
    x.right = h;
    x.isRed = h.isRed;
    h.isRed = true;
    return x;
  };

  const colorFlip = h => {
    h.isRed = !h.isRed;
    h.left.isRed = !h.left.isRed;
    h.right.isRed = !h.right.isRed;
  };

  const moveRedLeft = h => {
    //throw 'Preconditions failed' if !(!h.left.isRed && !h.left.left?.isRed)
    colorFlip(h);

    if (h.right !== null && h.right.left !== null && h.right.left.isRed) {
      h.right = rotateRight(h.right);
      h = rotateLeft(h);
      colorFlip(h);
    }

    return h;
  };

  const moveRedRight = h => {
    //throw 'Preconditions failed' if !(!h.right.isRed && !h.right.left?.isRed)
    colorFlip(h);

    if (h.left !== null && h.left.left !== null && h.left.left.isRed) {
      h = rotateRight(h);
      colorFlip(h);
    }

    return h;
  };

  const insertInNode = (h, value, compare, onInsertConflict) => {
    if (h === null) {
      return new Node$1(value);
    } //if h.left isnt null && h.left.isRed && h.right isnt null && h.right.isRed
    //  colorFlip(h)


    const cmp = compare(value, h.value);

    if (cmp === 0) {
      h.value = onInsertConflict(h.value, value);
    } else if (cmp < 0) {
      h.left = insertInNode(h.left, value, compare, onInsertConflict);
    } else {
      h.right = insertInNode(h.right, value, compare, onInsertConflict);
    }

    if (h.right !== null && h.right.isRed && !(h.left !== null && h.left.isRed)) {
      h = rotateLeft(h);
    }

    if (h.left !== null && h.left.isRed && h.left.left !== null && h.left.left.isRed) {
      h = rotateRight(h);
    } // Put this here -- I couldn't get the whole thing to work otherwise :(


    if (h.left !== null && h.left.isRed && h.right !== null && h.right.isRed) {
      colorFlip(h);
    }

    return h;
  };

  const findMinNode = h => {
    while (h.left !== null) {
      h = h.left;
    }

    return h;
  };

  const fixUp = h => {
    // Fix right-leaning red nodes
    if (h.right !== null && h.right.isRed) {
      h = rotateLeft(h);
    } // Handle a 4-node that traverses down the left


    if (h.left !== null && h.left.isRed && h.left.left !== null && h.left.left.isRed) {
      h = rotateRight(h);
    } // split 4-nodes


    if (h.left !== null && h.left.isRed && h.right !== null && h.right.isRed) {
      colorFlip(h);
    }

    return h;
  };

  const removeMinNode = h => {
    if (h.left === null) {
      return null;
    }

    if (!h.left.isRed && !(h.left.left !== null && h.left.left.isRed)) {
      h = moveRedLeft(h);
    }

    h.left = removeMinNode(h.left);
    return fixUp(h);
  };

  const removeFromNode = (h, value, compare) => {
    if (h === null) {
      throw 'Value not in set';
    }

    if (compare(value, h.value) < 0) {
      if (h.left === null) {
        throw 'Value not in set';
      }

      if (!h.left.isRed && !(h.left.left !== null && h.left.left.isRed)) {
        h = moveRedLeft(h);
      }

      h.left = removeFromNode(h.left, value, compare);
    } else {
      if (h.left !== null && h.left.isRed) {
        h = rotateRight(h);
      }

      if (h.right === null) {
        if (compare(value, h.value) === 0) {
          return null; // leaf node; LLRB assures no left value here
        } else {
          throw 'Value not in set';
        }
      }

      if (!h.right.isRed && !(h.right.left !== null && h.right.left.isRed)) {
        h = moveRedRight(h);
      }

      if (compare(value, h.value) === 0) {
        h.value = findMinNode(h.right).value;
        h.right = removeMinNode(h.right);
      } else {
        h.right = removeFromNode(h.right, value, compare);
      }
    }

    if (h !== null) {
      h = fixUp(h);
    }

    return h;
  };

  class RedBlackTreeStrategy extends AbstractBinaryTree {
    constructor(options) {
      super();
      this.options = options;
      this.comparator = this.options.comparator;
      this.onInsertConflict = this.options.onInsertConflict;
      this.root = null;
    }

    insert(value) {
      this.root = insertInNode(this.root, value, this.comparator, this.onInsertConflict);
      this.root.isRed = false; // always
    }

    remove(value) {
      this.root = removeFromNode(this.root, value, this.comparator);

      if (this.root !== null) {
        this.root.isRed = false;
      }
    }

  }

  const InsertConflictResolvers = {
    OnInsertConflictThrow: (oldValue, newValue) => {
      throw new Error("Value already in set");
    },
    OnInsertConflictReplace: (oldValue, newValue) => newValue,
    OnInsertConflictIgnore: (oldValue, newValue) => oldValue
  };

  class SortedSet extends AbstractSortedSet {
    constructor(options) {
      options || (options = {});
      options.strategy || (options.strategy = RedBlackTreeStrategy);
      options.comparator || (options.comparator = function (a, b) {
        return (a || 0) - (b || 0);
      });
      options.onInsertConflict || (options.onInsertConflict = InsertConflictResolvers.OnInsertConflictThrow);
      super(options);
    }

  }
  SortedSet.ArrayStrategy = ArrayStrategy;
  SortedSet.BinaryTreeStrategy = BinaryTreeStrategy;
  SortedSet.RedBlackTreeStrategy = RedBlackTreeStrategy;
  Object.assign(SortedSet, InsertConflictResolvers);

  return SortedSet;

})));
//# sourceMappingURL=sorted-set.js.map


/***/ }),

/***/ "../../node_modules/level-transcoder/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const encodings = __webpack_require__("../../node_modules/level-transcoder/lib/encodings.js")
const { Encoding } = __webpack_require__("../../node_modules/level-transcoder/lib/encoding.js")
const { BufferFormat, ViewFormat, UTF8Format } = __webpack_require__("../../node_modules/level-transcoder/lib/formats.js")

const kFormats = Symbol('formats')
const kEncodings = Symbol('encodings')
const validFormats = new Set(['buffer', 'view', 'utf8'])

/** @template T */
class Transcoder {
  /**
   * @param {Array<'buffer'|'view'|'utf8'>} formats
   */
  constructor (formats) {
    if (!Array.isArray(formats)) {
      throw new TypeError("The first argument 'formats' must be an array")
    } else if (!formats.every(f => validFormats.has(f))) {
      // Note: we only only support aliases in key- and valueEncoding options (where we already did)
      throw new TypeError("Format must be one of 'buffer', 'view', 'utf8'")
    }

    /** @type {Map<string|MixedEncoding<any, any, any>, Encoding<any, any, any>>} */
    this[kEncodings] = new Map()
    this[kFormats] = new Set(formats)

    // Register encodings (done early in order to populate encodings())
    for (const k in encodings) {
      try {
        this.encoding(k)
      } catch (err) {
        /* istanbul ignore if: assertion */
        if (err.code !== 'LEVEL_ENCODING_NOT_SUPPORTED') throw err
      }
    }
  }

  /**
   * @returns {Array<Encoding<any,T,any>>}
   */
  encodings () {
    return Array.from(new Set(this[kEncodings].values()))
  }

  /**
   * @param {string|MixedEncoding<any, any, any>} encoding
   * @returns {Encoding<any, T, any>}
   */
  encoding (encoding) {
    let resolved = this[kEncodings].get(encoding)

    if (resolved === undefined) {
      if (typeof encoding === 'string' && encoding !== '') {
        resolved = lookup[encoding]

        if (!resolved) {
          throw new ModuleError(`Encoding '${encoding}' is not found`, {
            code: 'LEVEL_ENCODING_NOT_FOUND'
          })
        }
      } else if (typeof encoding !== 'object' || encoding === null) {
        throw new TypeError("First argument 'encoding' must be a string or object")
      } else {
        resolved = from(encoding)
      }

      const { name, format } = resolved

      if (!this[kFormats].has(format)) {
        if (this[kFormats].has('view')) {
          resolved = resolved.createViewTranscoder()
        } else if (this[kFormats].has('buffer')) {
          resolved = resolved.createBufferTranscoder()
        } else if (this[kFormats].has('utf8')) {
          resolved = resolved.createUTF8Transcoder()
        } else {
          throw new ModuleError(`Encoding '${name}' cannot be transcoded`, {
            code: 'LEVEL_ENCODING_NOT_SUPPORTED'
          })
        }
      }

      for (const k of [encoding, name, resolved.name, resolved.commonName]) {
        this[kEncodings].set(k, resolved)
      }
    }

    return resolved
  }
}

exports.Transcoder = Transcoder

/**
 * @param {MixedEncoding<any, any, any>} options
 * @returns {Encoding<any, any, any>}
 */
function from (options) {
  if (options instanceof Encoding) {
    return options
  }

  // Loosely typed for ecosystem compatibility
  const maybeType = 'type' in options && typeof options.type === 'string' ? options.type : undefined
  const name = options.name || maybeType || `anonymous-${anonymousCount++}`

  switch (detectFormat(options)) {
    case 'view': return new ViewFormat({ ...options, name })
    case 'utf8': return new UTF8Format({ ...options, name })
    case 'buffer': return new BufferFormat({ ...options, name })
    default: {
      throw new TypeError("Format must be one of 'buffer', 'view', 'utf8'")
    }
  }
}

/**
 * If format is not provided, fallback to detecting `level-codec`
 * or `multiformats` encodings, else assume a format of buffer.
 * @param {MixedEncoding<any, any, any>} options
 * @returns {string}
 */
function detectFormat (options) {
  if ('format' in options && options.format !== undefined) {
    return options.format
  } else if ('buffer' in options && typeof options.buffer === 'boolean') {
    return options.buffer ? 'buffer' : 'utf8' // level-codec
  } else if ('code' in options && Number.isInteger(options.code)) {
    return 'view' // multiformats
  } else {
    return 'buffer'
  }
}

/**
 * @typedef {import('./lib/encoding').MixedEncoding<TIn,TFormat,TOut>} MixedEncoding
 * @template TIn, TFormat, TOut
 */

/**
 * @type {Object.<string, Encoding<any, any, any>>}
 */
const aliases = {
  binary: encodings.buffer,
  'utf-8': encodings.utf8
}

/**
 * @type {Object.<string, Encoding<any, any, any>>}
 */
const lookup = {
  ...encodings,
  ...aliases
}

let anonymousCount = 0


/***/ }),

/***/ "../../node_modules/level-transcoder/lib/encoding.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const formats = new Set(['buffer', 'view', 'utf8'])

/**
 * @template TIn, TFormat, TOut
 * @abstract
 */
class Encoding {
  /**
   * @param {IEncoding<TIn,TFormat,TOut>} options
   */
  constructor (options) {
    /** @type {(data: TIn) => TFormat} */
    this.encode = options.encode || this.encode

    /** @type {(data: TFormat) => TOut} */
    this.decode = options.decode || this.decode

    /** @type {string} */
    this.name = options.name || this.name

    /** @type {string} */
    this.format = options.format || this.format

    if (typeof this.encode !== 'function') {
      throw new TypeError("The 'encode' property must be a function")
    }

    if (typeof this.decode !== 'function') {
      throw new TypeError("The 'decode' property must be a function")
    }

    this.encode = this.encode.bind(this)
    this.decode = this.decode.bind(this)

    if (typeof this.name !== 'string' || this.name === '') {
      throw new TypeError("The 'name' property must be a string")
    }

    if (typeof this.format !== 'string' || !formats.has(this.format)) {
      throw new TypeError("The 'format' property must be one of 'buffer', 'view', 'utf8'")
    }

    if (options.createViewTranscoder) {
      this.createViewTranscoder = options.createViewTranscoder
    }

    if (options.createBufferTranscoder) {
      this.createBufferTranscoder = options.createBufferTranscoder
    }

    if (options.createUTF8Transcoder) {
      this.createUTF8Transcoder = options.createUTF8Transcoder
    }
  }

  get commonName () {
    return /** @type {string} */ (this.name.split('+')[0])
  }

  /** @return {BufferFormat<TIn,TOut>} */
  createBufferTranscoder () {
    throw new ModuleError(`Encoding '${this.name}' cannot be transcoded to 'buffer'`, {
      code: 'LEVEL_ENCODING_NOT_SUPPORTED'
    })
  }

  /** @return {ViewFormat<TIn,TOut>} */
  createViewTranscoder () {
    throw new ModuleError(`Encoding '${this.name}' cannot be transcoded to 'view'`, {
      code: 'LEVEL_ENCODING_NOT_SUPPORTED'
    })
  }

  /** @return {UTF8Format<TIn,TOut>} */
  createUTF8Transcoder () {
    throw new ModuleError(`Encoding '${this.name}' cannot be transcoded to 'utf8'`, {
      code: 'LEVEL_ENCODING_NOT_SUPPORTED'
    })
  }
}

exports.Encoding = Encoding

/**
 * @typedef {import('./encoding').IEncoding<TIn,TFormat,TOut>} IEncoding
 * @template TIn, TFormat, TOut
 */

/**
 * @typedef {import('./formats').BufferFormat<TIn,TOut>} BufferFormat
 * @template TIn, TOut
 */

/**
 * @typedef {import('./formats').ViewFormat<TIn,TOut>} ViewFormat
 * @template TIn, TOut
 */

/**
 * @typedef {import('./formats').UTF8Format<TIn,TOut>} UTF8Format
 * @template TIn, TOut
 */


/***/ }),

/***/ "../../node_modules/level-transcoder/lib/encodings.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { Buffer } = __webpack_require__("../../node_modules/buffer/index.js") || { Buffer: { isBuffer: () => false } }
const { textEncoder, textDecoder } = __webpack_require__("../../node_modules/level-transcoder/lib/text-endec.js")()
const { BufferFormat, ViewFormat, UTF8Format } = __webpack_require__("../../node_modules/level-transcoder/lib/formats.js")

/** @type {<T>(v: T) => v} */
const identity = (v) => v

/**
 * @type {typeof import('./encodings').utf8}
 */
exports.utf8 = new UTF8Format({
  encode: function (data) {
    // On node 16.9.1 buffer.toString() is 5x faster than TextDecoder
    return Buffer.isBuffer(data)
      ? data.toString('utf8')
      : ArrayBuffer.isView(data)
        ? textDecoder.decode(data)
        : String(data)
  },
  decode: identity,
  name: 'utf8',
  createViewTranscoder () {
    return new ViewFormat({
      encode: function (data) {
        return ArrayBuffer.isView(data) ? data : textEncoder.encode(data)
      },
      decode: function (data) {
        return textDecoder.decode(data)
      },
      name: `${this.name}+view`
    })
  },
  createBufferTranscoder () {
    return new BufferFormat({
      encode: function (data) {
        return Buffer.isBuffer(data)
          ? data
          : ArrayBuffer.isView(data)
            ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
            : Buffer.from(String(data), 'utf8')
      },
      decode: function (data) {
        return data.toString('utf8')
      },
      name: `${this.name}+buffer`
    })
  }
})

/**
 * @type {typeof import('./encodings').json}
 */
exports.json = new UTF8Format({
  encode: JSON.stringify,
  decode: JSON.parse,
  name: 'json'
})

/**
 * @type {typeof import('./encodings').buffer}
 */
exports.buffer = new BufferFormat({
  encode: function (data) {
    return Buffer.isBuffer(data)
      ? data
      : ArrayBuffer.isView(data)
        ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        : Buffer.from(String(data), 'utf8')
  },
  decode: identity,
  name: 'buffer',
  createViewTranscoder () {
    return new ViewFormat({
      encode: function (data) {
        return ArrayBuffer.isView(data) ? data : Buffer.from(String(data), 'utf8')
      },
      decode: function (data) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      },
      name: `${this.name}+view`
    })
  }
})

/**
 * @type {typeof import('./encodings').view}
 */
exports.view = new ViewFormat({
  encode: function (data) {
    return ArrayBuffer.isView(data) ? data : textEncoder.encode(data)
  },
  decode: identity,
  name: 'view',
  createBufferTranscoder () {
    return new BufferFormat({
      encode: function (data) {
        return Buffer.isBuffer(data)
          ? data
          : ArrayBuffer.isView(data)
            ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
            : Buffer.from(String(data), 'utf8')
      },
      decode: identity,
      name: `${this.name}+buffer`
    })
  }
})

/**
 * @type {typeof import('./encodings').hex}
 */
exports.hex = new BufferFormat({
  encode: function (data) {
    return Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'hex')
  },
  decode: function (buffer) {
    return buffer.toString('hex')
  },
  name: 'hex'
})

/**
 * @type {typeof import('./encodings').base64}
 */
exports.base64 = new BufferFormat({
  encode: function (data) {
    return Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'base64')
  },
  decode: function (buffer) {
    return buffer.toString('base64')
  },
  name: 'base64'
})


/***/ }),

/***/ "../../node_modules/level-transcoder/lib/formats.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const { Buffer } = __webpack_require__("../../node_modules/buffer/index.js") || {}
const { Encoding } = __webpack_require__("../../node_modules/level-transcoder/lib/encoding.js")
const textEndec = __webpack_require__("../../node_modules/level-transcoder/lib/text-endec.js")

/**
 * @template TIn, TOut
 * @extends {Encoding<TIn,Buffer,TOut>}
 */
class BufferFormat extends Encoding {
  /**
   * @param {Omit<IEncoding<TIn, Buffer, TOut>, 'format'>} options
   */
  constructor (options) {
    super({ ...options, format: 'buffer' })
  }

  /** @override */
  createViewTranscoder () {
    return new ViewFormat({
      encode: this.encode, // Buffer is a view (UInt8Array)
      decode: (data) => this.decode(
        Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      ),
      name: `${this.name}+view`
    })
  }

  /** @override */
  createBufferTranscoder () {
    return this
  }
}

/**
 * @extends {Encoding<TIn,Uint8Array,TOut>}
 * @template TIn, TOut
 */
class ViewFormat extends Encoding {
  /**
   * @param {Omit<IEncoding<TIn, Uint8Array, TOut>, 'format'>} options
   */
  constructor (options) {
    super({ ...options, format: 'view' })
  }

  /** @override */
  createBufferTranscoder () {
    return new BufferFormat({
      encode: (data) => {
        const view = this.encode(data)
        return Buffer.from(view.buffer, view.byteOffset, view.byteLength)
      },
      decode: this.decode, // Buffer is a view (UInt8Array)
      name: `${this.name}+buffer`
    })
  }

  /** @override */
  createViewTranscoder () {
    return this
  }
}

/**
 * @extends {Encoding<TIn,string,TOut>}
 * @template TIn, TOut
 */
class UTF8Format extends Encoding {
  /**
   * @param {Omit<IEncoding<TIn, string, TOut>, 'format'>} options
   */
  constructor (options) {
    super({ ...options, format: 'utf8' })
  }

  /** @override */
  createBufferTranscoder () {
    return new BufferFormat({
      encode: (data) => Buffer.from(this.encode(data), 'utf8'),
      decode: (data) => this.decode(data.toString('utf8')),
      name: `${this.name}+buffer`
    })
  }

  /** @override */
  createViewTranscoder () {
    const { textEncoder, textDecoder } = textEndec()

    return new ViewFormat({
      encode: (data) => textEncoder.encode(this.encode(data)),
      decode: (data) => this.decode(textDecoder.decode(data)),
      name: `${this.name}+view`
    })
  }

  /** @override */
  createUTF8Transcoder () {
    return this
  }
}

exports.BufferFormat = BufferFormat
exports.ViewFormat = ViewFormat
exports.UTF8Format = UTF8Format

/**
 * @typedef {import('./encoding').IEncoding<TIn,TFormat,TOut>} IEncoding
 * @template TIn, TFormat, TOut
 */


/***/ }),

/***/ "../../node_modules/level-transcoder/lib/text-endec.js":
/***/ ((module) => {



/** @type {{ textEncoder: TextEncoder, textDecoder: TextDecoder }|null} */
let lazy = null

/**
 * Get semi-global instances of TextEncoder and TextDecoder.
 * @returns {{ textEncoder: TextEncoder, textDecoder: TextDecoder }}
 */
module.exports = function () {
  if (lazy === null) {
    lazy = {
      textEncoder: new TextEncoder(),
      textDecoder: new TextDecoder()
    }
  }

  return lazy
}


/***/ }),

/***/ "../../node_modules/loupe/loupe.js":
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

(function (global, factory) {
   true ? factory(exports) :
  0;
}(this, (function (exports) { 'use strict';

  function _typeof(obj) {
    "@babel/helpers - typeof";

    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArrayLimit(arr, i) {
    if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  var ansiColors = {
    bold: ['1', '22'],
    dim: ['2', '22'],
    italic: ['3', '23'],
    underline: ['4', '24'],
    // 5 & 6 are blinking
    inverse: ['7', '27'],
    hidden: ['8', '28'],
    strike: ['9', '29'],
    // 10-20 are fonts
    // 21-29 are resets for 1-9
    black: ['30', '39'],
    red: ['31', '39'],
    green: ['32', '39'],
    yellow: ['33', '39'],
    blue: ['34', '39'],
    magenta: ['35', '39'],
    cyan: ['36', '39'],
    white: ['37', '39'],
    brightblack: ['30;1', '39'],
    brightred: ['31;1', '39'],
    brightgreen: ['32;1', '39'],
    brightyellow: ['33;1', '39'],
    brightblue: ['34;1', '39'],
    brightmagenta: ['35;1', '39'],
    brightcyan: ['36;1', '39'],
    brightwhite: ['37;1', '39'],
    grey: ['90', '39']
  };
  var styles = {
    special: 'cyan',
    number: 'yellow',
    bigint: 'yellow',
    boolean: 'yellow',
    undefined: 'grey',
    null: 'bold',
    string: 'green',
    symbol: 'green',
    date: 'magenta',
    regexp: 'red'
  };
  var truncator = '…';

  function colorise(value, styleType) {
    var color = ansiColors[styles[styleType]] || ansiColors[styleType];

    if (!color) {
      return String(value);
    }

    return "\x1B[".concat(color[0], "m").concat(String(value), "\x1B[").concat(color[1], "m");
  }

  function normaliseOptions() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$showHidden = _ref.showHidden,
        showHidden = _ref$showHidden === void 0 ? false : _ref$showHidden,
        _ref$depth = _ref.depth,
        depth = _ref$depth === void 0 ? 2 : _ref$depth,
        _ref$colors = _ref.colors,
        colors = _ref$colors === void 0 ? false : _ref$colors,
        _ref$customInspect = _ref.customInspect,
        customInspect = _ref$customInspect === void 0 ? true : _ref$customInspect,
        _ref$showProxy = _ref.showProxy,
        showProxy = _ref$showProxy === void 0 ? false : _ref$showProxy,
        _ref$maxArrayLength = _ref.maxArrayLength,
        maxArrayLength = _ref$maxArrayLength === void 0 ? Infinity : _ref$maxArrayLength,
        _ref$breakLength = _ref.breakLength,
        breakLength = _ref$breakLength === void 0 ? Infinity : _ref$breakLength,
        _ref$seen = _ref.seen,
        seen = _ref$seen === void 0 ? [] : _ref$seen,
        _ref$truncate = _ref.truncate,
        truncate = _ref$truncate === void 0 ? Infinity : _ref$truncate,
        _ref$stylize = _ref.stylize,
        stylize = _ref$stylize === void 0 ? String : _ref$stylize;

    var options = {
      showHidden: Boolean(showHidden),
      depth: Number(depth),
      colors: Boolean(colors),
      customInspect: Boolean(customInspect),
      showProxy: Boolean(showProxy),
      maxArrayLength: Number(maxArrayLength),
      breakLength: Number(breakLength),
      truncate: Number(truncate),
      seen: seen,
      stylize: stylize
    };

    if (options.colors) {
      options.stylize = colorise;
    }

    return options;
  }
  function truncate(string, length) {
    var tail = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : truncator;
    string = String(string);
    var tailLength = tail.length;
    var stringLength = string.length;

    if (tailLength > length && stringLength > tailLength) {
      return tail;
    }

    if (stringLength > length && stringLength > tailLength) {
      return "".concat(string.slice(0, length - tailLength)).concat(tail);
    }

    return string;
  } // eslint-disable-next-line complexity

  function inspectList(list, options, inspectItem) {
    var separator = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : ', ';
    inspectItem = inspectItem || options.inspect;
    var size = list.length;
    if (size === 0) return '';
    var originalLength = options.truncate;
    var output = '';
    var peek = '';
    var truncated = '';

    for (var i = 0; i < size; i += 1) {
      var last = i + 1 === list.length;
      var secondToLast = i + 2 === list.length;
      truncated = "".concat(truncator, "(").concat(list.length - i, ")");
      var value = list[i]; // If there is more than one remaining we need to account for a separator of `, `

      options.truncate = originalLength - output.length - (last ? 0 : separator.length);
      var string = peek || inspectItem(value, options) + (last ? '' : separator);
      var nextLength = output.length + string.length;
      var truncatedLength = nextLength + truncated.length; // If this is the last element, and adding it would
      // take us over length, but adding the truncator wouldn't - then break now

      if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
        break;
      } // If this isn't the last or second to last element to scan,
      // but the string is already over length then break here


      if (!last && !secondToLast && truncatedLength > originalLength) {
        break;
      } // Peek at the next string to determine if we should
      // break early before adding this item to the output


      peek = last ? '' : inspectItem(list[i + 1], options) + (secondToLast ? '' : separator); // If we have one element left, but this element and
      // the next takes over length, the break early

      if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
        break;
      }

      output += string; // If the next element takes us to length -
      // but there are more after that, then we should truncate now

      if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
        truncated = "".concat(truncator, "(").concat(list.length - i - 1, ")");
        break;
      }

      truncated = '';
    }

    return "".concat(output).concat(truncated);
  }

  function quoteComplexKey(key) {
    if (key.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
      return key;
    }

    return JSON.stringify(key).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
  }

  function inspectProperty(_ref2, options) {
    var _ref3 = _slicedToArray(_ref2, 2),
        key = _ref3[0],
        value = _ref3[1];

    options.truncate -= 2;

    if (typeof key === 'string') {
      key = quoteComplexKey(key);
    } else if (typeof key !== 'number') {
      key = "[".concat(options.inspect(key, options), "]");
    }

    options.truncate -= key.length;
    value = options.inspect(value, options);
    return "".concat(key, ": ").concat(value);
  }

  function inspectArray(array, options) {
    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    var nonIndexProperties = Object.keys(array).slice(array.length);
    if (!array.length && !nonIndexProperties.length) return '[]';
    options.truncate -= 4;
    var listContents = inspectList(array, options);
    options.truncate -= listContents.length;
    var propertyContents = '';

    if (nonIndexProperties.length) {
      propertyContents = inspectList(nonIndexProperties.map(function (key) {
        return [key, array[key]];
      }), options, inspectProperty);
    }

    return "[ ".concat(listContents).concat(propertyContents ? ", ".concat(propertyContents) : '', " ]");
  }

  /* !
   * Chai - getFuncName utility
   * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   */

  /**
   * ### .getFuncName(constructorFn)
   *
   * Returns the name of a function.
   * When a non-function instance is passed, returns `null`.
   * This also includes a polyfill function if `aFunc.name` is not defined.
   *
   * @name getFuncName
   * @param {Function} funct
   * @namespace Utils
   * @api public
   */

  var toString = Function.prototype.toString;
  var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\s\(\/]+)/;
  function getFuncName(aFunc) {
    if (typeof aFunc !== 'function') {
      return null;
    }

    var name = '';
    if (typeof Function.prototype.name === 'undefined' && typeof aFunc.name === 'undefined') {
      // Here we run a polyfill if Function does not support the `name` property and if aFunc.name is not defined
      var match = toString.call(aFunc).match(functionNameMatch);
      if (match) {
        name = match[1];
      }
    } else {
      // If we've got a `name` property we just use it
      name = aFunc.name;
    }

    return name;
  }

  var getFuncName_1 = getFuncName;

  var getArrayName = function getArrayName(array) {
    // We need to special case Node.js' Buffers, which report to be Uint8Array
    if (typeof Buffer === 'function' && array instanceof Buffer) {
      return 'Buffer';
    }

    if (array[Symbol.toStringTag]) {
      return array[Symbol.toStringTag];
    }

    return getFuncName_1(array.constructor);
  };

  function inspectTypedArray(array, options) {
    var name = getArrayName(array);
    options.truncate -= name.length + 4; // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties

    var nonIndexProperties = Object.keys(array).slice(array.length);
    if (!array.length && !nonIndexProperties.length) return "".concat(name, "[]"); // As we know TypedArrays only contain Unsigned Integers, we can skip inspecting each one and simply
    // stylise the toString() value of them

    var output = '';

    for (var i = 0; i < array.length; i++) {
      var string = "".concat(options.stylize(truncate(array[i], options.truncate), 'number')).concat(i === array.length - 1 ? '' : ', ');
      options.truncate -= string.length;

      if (array[i] !== array.length && options.truncate <= 3) {
        output += "".concat(truncator, "(").concat(array.length - array[i] + 1, ")");
        break;
      }

      output += string;
    }

    var propertyContents = '';

    if (nonIndexProperties.length) {
      propertyContents = inspectList(nonIndexProperties.map(function (key) {
        return [key, array[key]];
      }), options, inspectProperty);
    }

    return "".concat(name, "[ ").concat(output).concat(propertyContents ? ", ".concat(propertyContents) : '', " ]");
  }

  function inspectDate(dateObject, options) {
    // If we need to - truncate the time portion, but never the date
    var split = dateObject.toJSON().split('T');
    var date = split[0];
    return options.stylize("".concat(date, "T").concat(truncate(split[1], options.truncate - date.length - 1)), 'date');
  }

  function inspectFunction(func, options) {
    var name = getFuncName_1(func);

    if (!name) {
      return options.stylize('[Function]', 'special');
    }

    return options.stylize("[Function ".concat(truncate(name, options.truncate - 11), "]"), 'special');
  }

  function inspectMapEntry(_ref, options) {
    var _ref2 = _slicedToArray(_ref, 2),
        key = _ref2[0],
        value = _ref2[1];

    options.truncate -= 4;
    key = options.inspect(key, options);
    options.truncate -= key.length;
    value = options.inspect(value, options);
    return "".concat(key, " => ").concat(value);
  } // IE11 doesn't support `map.entries()`


  function mapToEntries(map) {
    var entries = [];
    map.forEach(function (value, key) {
      entries.push([key, value]);
    });
    return entries;
  }

  function inspectMap(map, options) {
    var size = map.size - 1;

    if (size <= 0) {
      return 'Map{}';
    }

    options.truncate -= 7;
    return "Map{ ".concat(inspectList(mapToEntries(map), options, inspectMapEntry), " }");
  }

  var isNaN = Number.isNaN || function (i) {
    return i !== i;
  }; // eslint-disable-line no-self-compare


  function inspectNumber(number, options) {
    if (isNaN(number)) {
      return options.stylize('NaN', 'number');
    }

    if (number === Infinity) {
      return options.stylize('Infinity', 'number');
    }

    if (number === -Infinity) {
      return options.stylize('-Infinity', 'number');
    }

    if (number === 0) {
      return options.stylize(1 / number === Infinity ? '+0' : '-0', 'number');
    }

    return options.stylize(truncate(number, options.truncate), 'number');
  }

  function inspectBigInt(number, options) {
    var nums = truncate(number.toString(), options.truncate - 1);
    if (nums !== truncator) nums += 'n';
    return options.stylize(nums, 'bigint');
  }

  function inspectRegExp(value, options) {
    var flags = value.toString().split('/')[2];
    var sourceLength = options.truncate - (2 + flags.length);
    var source = value.source;
    return options.stylize("/".concat(truncate(source, sourceLength), "/").concat(flags), 'regexp');
  }

  function arrayFromSet(set) {
    var values = [];
    set.forEach(function (value) {
      values.push(value);
    });
    return values;
  }

  function inspectSet(set, options) {
    if (set.size === 0) return 'Set{}';
    options.truncate -= 7;
    return "Set{ ".concat(inspectList(arrayFromSet(set), options), " }");
  }

  var stringEscapeChars = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5" + "\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", 'g');
  var escapeCharacters = {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    "'": "\\'",
    '\\': '\\\\'
  };
  var hex = 16;
  var unicodeLength = 4;

  function escape(char) {
    return escapeCharacters[char] || "\\u".concat("0000".concat(char.charCodeAt(0).toString(hex)).slice(-unicodeLength));
  }

  function inspectString(string, options) {
    if (stringEscapeChars.test(string)) {
      string = string.replace(stringEscapeChars, escape);
    }

    return options.stylize("'".concat(truncate(string, options.truncate - 2), "'"), 'string');
  }

  function inspectSymbol(value) {
    if ('description' in Symbol.prototype) {
      return value.description ? "Symbol(".concat(value.description, ")") : 'Symbol()';
    }

    return value.toString();
  }

  var getPromiseValue = function getPromiseValue() {
    return 'Promise{…}';
  };

  try {
    var _process$binding = process.binding('util'),
        getPromiseDetails = _process$binding.getPromiseDetails,
        kPending = _process$binding.kPending,
        kRejected = _process$binding.kRejected;

    if (Array.isArray(getPromiseDetails(Promise.resolve()))) {
      getPromiseValue = function getPromiseValue(value, options) {
        var _getPromiseDetails = getPromiseDetails(value),
            _getPromiseDetails2 = _slicedToArray(_getPromiseDetails, 2),
            state = _getPromiseDetails2[0],
            innerValue = _getPromiseDetails2[1];

        if (state === kPending) {
          return 'Promise{<pending>}';
        }

        return "Promise".concat(state === kRejected ? '!' : '', "{").concat(options.inspect(innerValue, options), "}");
      };
    }
  } catch (notNode) {
    /* ignore */
  }

  var inspectPromise = getPromiseValue;

  function inspectObject(object, options) {
    var properties = Object.getOwnPropertyNames(object);
    var symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];

    if (properties.length === 0 && symbols.length === 0) {
      return '{}';
    }

    options.truncate -= 4;
    options.seen = options.seen || [];

    if (options.seen.indexOf(object) >= 0) {
      return '[Circular]';
    }

    options.seen.push(object);
    var propertyContents = inspectList(properties.map(function (key) {
      return [key, object[key]];
    }), options, inspectProperty);
    var symbolContents = inspectList(symbols.map(function (key) {
      return [key, object[key]];
    }), options, inspectProperty);
    options.seen.pop();
    var sep = '';

    if (propertyContents && symbolContents) {
      sep = ', ';
    }

    return "{ ".concat(propertyContents).concat(sep).concat(symbolContents, " }");
  }

  var toStringTag = typeof Symbol !== 'undefined' && Symbol.toStringTag ? Symbol.toStringTag : false;
  function inspectClass(value, options) {
    var name = '';

    if (toStringTag && toStringTag in value) {
      name = value[toStringTag];
    }

    name = name || getFuncName_1(value.constructor); // Babel transforms anonymous classes to the name `_class`

    if (!name || name === '_class') {
      name = '<Anonymous Class>';
    }

    options.truncate -= name.length;
    return "".concat(name).concat(inspectObject(value, options));
  }

  function inspectArguments(args, options) {
    if (args.length === 0) return 'Arguments[]';
    options.truncate -= 13;
    return "Arguments[ ".concat(inspectList(args, options), " ]");
  }

  var errorKeys = ['stack', 'line', 'column', 'name', 'message', 'fileName', 'lineNumber', 'columnNumber', 'number', 'description'];
  function inspectObject$1(error, options) {
    var properties = Object.getOwnPropertyNames(error).filter(function (key) {
      return errorKeys.indexOf(key) === -1;
    });
    var name = error.name;
    options.truncate -= name.length;
    var message = '';

    if (typeof error.message === 'string') {
      message = truncate(error.message, options.truncate);
    } else {
      properties.unshift('message');
    }

    message = message ? ": ".concat(message) : '';
    options.truncate -= message.length + 5;
    var propertyContents = inspectList(properties.map(function (key) {
      return [key, error[key]];
    }), options, inspectProperty);
    return "".concat(name).concat(message).concat(propertyContents ? " { ".concat(propertyContents, " }") : '');
  }

  function inspectAttribute(_ref, options) {
    var _ref2 = _slicedToArray(_ref, 2),
        key = _ref2[0],
        value = _ref2[1];

    options.truncate -= 3;

    if (!value) {
      return "".concat(options.stylize(key, 'yellow'));
    }

    return "".concat(options.stylize(key, 'yellow'), "=").concat(options.stylize("\"".concat(value, "\""), 'string'));
  }
  function inspectHTMLCollection(collection, options) {
    // eslint-disable-next-line no-use-before-define
    return inspectList(collection, options, inspectHTML, '\n');
  }
  function inspectHTML(element, options) {
    var properties = element.getAttributeNames();
    var name = element.tagName.toLowerCase();
    var head = options.stylize("<".concat(name), 'special');
    var headClose = options.stylize(">", 'special');
    var tail = options.stylize("</".concat(name, ">"), 'special');
    options.truncate -= name.length * 2 + 5;
    var propertyContents = '';

    if (properties.length > 0) {
      propertyContents += ' ';
      propertyContents += inspectList(properties.map(function (key) {
        return [key, element.getAttribute(key)];
      }), options, inspectAttribute, ' ');
    }

    options.truncate -= propertyContents.length;
    var truncate = options.truncate;
    var children = inspectHTMLCollection(element.children, options);

    if (children && children.length > truncate) {
      children = "".concat(truncator, "(").concat(element.children.length, ")");
    }

    return "".concat(head).concat(propertyContents).concat(headClose).concat(children).concat(tail);
  }

  var symbolsSupported = typeof Symbol === 'function' && typeof Symbol.for === 'function';
  var chaiInspect = symbolsSupported ? Symbol.for('chai/inspect') : '@@chai/inspect';
  var nodeInspect = false;

  try {
    // eslint-disable-next-line global-require
    var nodeUtil = __webpack_require__("?7779");

    nodeInspect = nodeUtil.inspect ? nodeUtil.inspect.custom : false;
  } catch (noNodeInspect) {
    nodeInspect = false;
  }

  var constructorMap = new WeakMap();
  var stringTagMap = {};
  var baseTypesMap = {
    undefined: function undefined$1(value, options) {
      return options.stylize('undefined', 'undefined');
    },
    null: function _null(value, options) {
      return options.stylize(null, 'null');
    },
    boolean: function boolean(value, options) {
      return options.stylize(value, 'boolean');
    },
    Boolean: function Boolean(value, options) {
      return options.stylize(value, 'boolean');
    },
    number: inspectNumber,
    Number: inspectNumber,
    bigint: inspectBigInt,
    BigInt: inspectBigInt,
    string: inspectString,
    String: inspectString,
    function: inspectFunction,
    Function: inspectFunction,
    symbol: inspectSymbol,
    // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
    Symbol: inspectSymbol,
    Array: inspectArray,
    Date: inspectDate,
    Map: inspectMap,
    Set: inspectSet,
    RegExp: inspectRegExp,
    Promise: inspectPromise,
    // WeakSet, WeakMap are totally opaque to us
    WeakSet: function WeakSet(value, options) {
      return options.stylize('WeakSet{…}', 'special');
    },
    WeakMap: function WeakMap(value, options) {
      return options.stylize('WeakMap{…}', 'special');
    },
    Arguments: inspectArguments,
    Int8Array: inspectTypedArray,
    Uint8Array: inspectTypedArray,
    Uint8ClampedArray: inspectTypedArray,
    Int16Array: inspectTypedArray,
    Uint16Array: inspectTypedArray,
    Int32Array: inspectTypedArray,
    Uint32Array: inspectTypedArray,
    Float32Array: inspectTypedArray,
    Float64Array: inspectTypedArray,
    Generator: function Generator() {
      return '';
    },
    DataView: function DataView() {
      return '';
    },
    ArrayBuffer: function ArrayBuffer() {
      return '';
    },
    Error: inspectObject$1,
    HTMLCollection: inspectHTMLCollection,
    NodeList: inspectHTMLCollection
  }; // eslint-disable-next-line complexity

  var inspectCustom = function inspectCustom(value, options, type) {
    if (chaiInspect in value && typeof value[chaiInspect] === 'function') {
      return value[chaiInspect](options);
    }

    if (nodeInspect && nodeInspect in value && typeof value[nodeInspect] === 'function') {
      return value[nodeInspect](options.depth, options);
    }

    if ('inspect' in value && typeof value.inspect === 'function') {
      return value.inspect(options.depth, options);
    }

    if ('constructor' in value && constructorMap.has(value.constructor)) {
      return constructorMap.get(value.constructor)(value, options);
    }

    if (stringTagMap[type]) {
      return stringTagMap[type](value, options);
    }

    return '';
  };

  var toString$1 = Object.prototype.toString; // eslint-disable-next-line complexity

  function inspect(value, options) {
    options = normaliseOptions(options);
    options.inspect = inspect;
    var _options = options,
        customInspect = _options.customInspect;
    var type = value === null ? 'null' : _typeof(value);

    if (type === 'object') {
      type = toString$1.call(value).slice(8, -1);
    } // If it is a base value that we already support, then use Loupe's inspector


    if (baseTypesMap[type]) {
      return baseTypesMap[type](value, options);
    } // If `options.customInspect` is set to true then try to use the custom inspector


    if (customInspect && value) {
      var output = inspectCustom(value, options, type);

      if (output) {
        if (typeof output === 'string') return output;
        return inspect(output, options);
      }
    }

    var proto = value ? Object.getPrototypeOf(value) : false; // If it's a plain Object then use Loupe's inspector

    if (proto === Object.prototype || proto === null) {
      return inspectObject(value, options);
    } // Specifically account for HTMLElements
    // eslint-disable-next-line no-undef


    if (value && typeof HTMLElement === 'function' && value instanceof HTMLElement) {
      return inspectHTML(value, options);
    }

    if ('constructor' in value) {
      // If it is a class, inspect it like an object but add the constructor name
      if (value.constructor !== Object) {
        return inspectClass(value, options);
      } // If it is an object with an anonymous prototype, display it as an object.


      return inspectObject(value, options);
    } // last chance to check if it's an object


    if (value === Object(value)) {
      return inspectObject(value, options);
    } // We have run out of options! Just stringify the value


    return options.stylize(String(value), type);
  }
  function registerConstructor(constructor, inspector) {
    if (constructorMap.has(constructor)) {
      return false;
    }

    constructorMap.add(constructor, inspector);
    return true;
  }
  function registerStringTag(stringTag, inspector) {
    if (stringTag in stringTagMap) {
      return false;
    }

    stringTagMap[stringTag] = inspector;
    return true;
  }
  var custom = chaiInspect;

  exports.custom = custom;
  exports.default = inspect;
  exports.inspect = inspect;
  exports.registerConstructor = registerConstructor;
  exports.registerStringTag = registerStringTag;

  Object.defineProperty(exports, '__esModule', { value: true });

})));


/***/ }),

/***/ "../../node_modules/memory-level/index.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const {
  AbstractLevel,
  AbstractIterator,
  AbstractKeyIterator,
  AbstractValueIterator
} = __webpack_require__("../../node_modules/abstract-level/index.js")

const ModuleError = __webpack_require__("../../node_modules/module-error/index.js")
const createRBT = __webpack_require__("../../node_modules/functional-red-black-tree/rbtree.js")

const rangeOptions = new Set(['gt', 'gte', 'lt', 'lte'])
const kNone = Symbol('none')
const kTree = Symbol('tree')
const kIterator = Symbol('iterator')
const kLowerBound = Symbol('lowerBound')
const kUpperBound = Symbol('upperBound')
const kOutOfRange = Symbol('outOfRange')
const kReverse = Symbol('reverse')
const kOptions = Symbol('options')
const kTest = Symbol('test')
const kAdvance = Symbol('advance')
const kInit = Symbol('init')

function compare (a, b) {
  // Only relevant when storeEncoding is 'utf8',
  // which guarantees that b is also a string.
  if (typeof a === 'string') {
    return a < b ? -1 : a > b ? 1 : 0
  }

  const length = Math.min(a.byteLength, b.byteLength)

  for (let i = 0; i < length; i++) {
    const cmp = a[i] - b[i]
    if (cmp !== 0) return cmp
  }

  return a.byteLength - b.byteLength
}

function gt (value) {
  return compare(value, this[kUpperBound]) > 0
}

function gte (value) {
  return compare(value, this[kUpperBound]) >= 0
}

function lt (value) {
  return compare(value, this[kUpperBound]) < 0
}

function lte (value) {
  return compare(value, this[kUpperBound]) <= 0
}

class MemoryIterator extends AbstractIterator {
  constructor (db, options) {
    super(db, options)
    this[kInit](db[kTree], options)
  }

  _next (callback) {
    if (!this[kIterator].valid) return this.nextTick(callback)

    const key = this[kIterator].key
    const value = this[kIterator].value

    if (!this[kTest](key)) return this.nextTick(callback)

    this[kIterator][this[kAdvance]]()
    this.nextTick(callback, null, key, value)
  }

  _nextv (size, options, callback) {
    const it = this[kIterator]
    const entries = []

    while (it.valid && entries.length < size && this[kTest](it.key)) {
      entries.push([it.key, it.value])
      it[this[kAdvance]]()
    }

    this.nextTick(callback, null, entries)
  }

  _all (options, callback) {
    const size = this.limit - this.count
    const it = this[kIterator]
    const entries = []

    while (it.valid && entries.length < size && this[kTest](it.key)) {
      entries.push([it.key, it.value])
      it[this[kAdvance]]()
    }

    this.nextTick(callback, null, entries)
  }
}

class MemoryKeyIterator extends AbstractKeyIterator {
  constructor (db, options) {
    super(db, options)
    this[kInit](db[kTree], options)
  }

  _next (callback) {
    if (!this[kIterator].valid) return this.nextTick(callback)

    const key = this[kIterator].key
    if (!this[kTest](key)) return this.nextTick(callback)

    this[kIterator][this[kAdvance]]()
    this.nextTick(callback, null, key)
  }

  _nextv (size, options, callback) {
    const it = this[kIterator]
    const keys = []

    while (it.valid && keys.length < size && this[kTest](it.key)) {
      keys.push(it.key)
      it[this[kAdvance]]()
    }

    this.nextTick(callback, null, keys)
  }

  _all (options, callback) {
    const size = this.limit - this.count
    const it = this[kIterator]
    const keys = []

    while (it.valid && keys.length < size && this[kTest](it.key)) {
      keys.push(it.key)
      it[this[kAdvance]]()
    }

    this.nextTick(callback, null, keys)
  }
}

class MemoryValueIterator extends AbstractValueIterator {
  constructor (db, options) {
    super(db, options)
    this[kInit](db[kTree], options)
  }

  _next (callback) {
    if (!this[kIterator].valid) return this.nextTick(callback)

    const key = this[kIterator].key
    const value = this[kIterator].value

    if (!this[kTest](key)) return this.nextTick(callback)

    this[kIterator][this[kAdvance]]()
    this.nextTick(callback, null, value)
  }

  _nextv (size, options, callback) {
    const it = this[kIterator]
    const values = []

    while (it.valid && values.length < size && this[kTest](it.key)) {
      values.push(it.value)
      it[this[kAdvance]]()
    }

    this.nextTick(callback, null, values)
  }

  _all (options, callback) {
    const size = this.limit - this.count
    const it = this[kIterator]
    const values = []

    while (it.valid && values.length < size && this[kTest](it.key)) {
      values.push(it.value)
      it[this[kAdvance]]()
    }

    this.nextTick(callback, null, values)
  }
}

for (const Ctor of [MemoryIterator, MemoryKeyIterator, MemoryValueIterator]) {
  Ctor.prototype[kInit] = function (tree, options) {
    this[kReverse] = options.reverse
    this[kOptions] = options

    if (!this[kReverse]) {
      this[kAdvance] = 'next'
      this[kLowerBound] = 'gte' in options ? options.gte : 'gt' in options ? options.gt : kNone
      this[kUpperBound] = 'lte' in options ? options.lte : 'lt' in options ? options.lt : kNone

      if (this[kLowerBound] === kNone) {
        this[kIterator] = tree.begin
      } else if ('gte' in options) {
        this[kIterator] = tree.ge(this[kLowerBound])
      } else {
        this[kIterator] = tree.gt(this[kLowerBound])
      }

      if (this[kUpperBound] !== kNone) {
        this[kTest] = 'lte' in options ? lte : lt
      }
    } else {
      this[kAdvance] = 'prev'
      this[kLowerBound] = 'lte' in options ? options.lte : 'lt' in options ? options.lt : kNone
      this[kUpperBound] = 'gte' in options ? options.gte : 'gt' in options ? options.gt : kNone

      if (this[kLowerBound] === kNone) {
        this[kIterator] = tree.end
      } else if ('lte' in options) {
        this[kIterator] = tree.le(this[kLowerBound])
      } else {
        this[kIterator] = tree.lt(this[kLowerBound])
      }

      if (this[kUpperBound] !== kNone) {
        this[kTest] = 'gte' in options ? gte : gt
      }
    }
  }

  Ctor.prototype[kTest] = function () {
    return true
  }

  Ctor.prototype[kOutOfRange] = function (target) {
    if (!this[kTest](target)) {
      return true
    } else if (this[kLowerBound] === kNone) {
      return false
    } else if (!this[kReverse]) {
      if ('gte' in this[kOptions]) {
        return compare(target, this[kLowerBound]) < 0
      } else {
        return compare(target, this[kLowerBound]) <= 0
      }
    } else {
      if ('lte' in this[kOptions]) {
        return compare(target, this[kLowerBound]) > 0
      } else {
        return compare(target, this[kLowerBound]) >= 0
      }
    }
  }

  Ctor.prototype._seek = function (target, options) {
    if (this[kOutOfRange](target)) {
      this[kIterator] = this[kIterator].tree.end
      this[kIterator].next()
    } else if (this[kReverse]) {
      this[kIterator] = this[kIterator].tree.le(target)
    } else {
      this[kIterator] = this[kIterator].tree.ge(target)
    }
  }
}

class MemoryLevel extends AbstractLevel {
  constructor (location, options, _) {
    // Take a dummy location argument to align with other implementations
    if (typeof location === 'object' && location !== null) {
      options = location
    }

    // To help migrating from level-mem to abstract-level
    if (typeof location === 'function' || typeof options === 'function' || typeof _ === 'function') {
      throw new ModuleError('The levelup-style callback argument has been removed', {
        code: 'LEVEL_LEGACY'
      })
    }

    let { storeEncoding, ...forward } = options || {}
    storeEncoding = storeEncoding || 'buffer'

    // Our compare() function supports Buffer, Uint8Array and strings
    if (!['buffer', 'view', 'utf8'].includes(storeEncoding)) {
      throw new ModuleError("The storeEncoding option must be 'buffer', 'view' or 'utf8'", {
        code: 'LEVEL_ENCODING_NOT_SUPPORTED'
      })
    }

    super({
      seek: true,
      permanence: false,
      createIfMissing: false,
      errorIfExists: false,
      encodings: { [storeEncoding]: true }
    }, forward)

    this[kTree] = createRBT(compare)
  }

  _put (key, value, options, callback) {
    const it = this[kTree].find(key)

    if (it.valid) {
      this[kTree] = it.update(value)
    } else {
      this[kTree] = this[kTree].insert(key, value)
    }

    this.nextTick(callback)
  }

  _get (key, options, callback) {
    const value = this[kTree].get(key)

    if (typeof value === 'undefined') {
      // TODO: use error code (not urgent, abstract-level normalizes this)
      return this.nextTick(callback, new Error('NotFound'))
    }

    this.nextTick(callback, null, value)
  }

  _getMany (keys, options, callback) {
    this.nextTick(callback, null, keys.map(key => this[kTree].get(key)))
  }

  _del (key, options, callback) {
    this[kTree] = this[kTree].remove(key)
    this.nextTick(callback)
  }

  _batch (operations, options, callback) {
    let tree = this[kTree]

    for (const op of operations) {
      const key = op.key
      const it = tree.find(key)

      if (op.type === 'put') {
        tree = it.valid ? it.update(op.value) : tree.insert(key, op.value)
      } else {
        tree = it.remove()
      }
    }

    this[kTree] = tree
    this.nextTick(callback)
  }

  _clear (options, callback) {
    if (options.limit === -1 && !Object.keys(options).some(isRangeOption)) {
      // Delete everything by creating a new empty tree.
      this[kTree] = createRBT(compare)
      return this.nextTick(callback)
    }

    const iterator = this._keys({ ...options })
    const limit = iterator.limit

    let count = 0

    const loop = () => {
      // TODO: add option to control "batch size"
      for (let i = 0; i < 500; i++) {
        if (++count > limit) return callback()
        if (!iterator[kIterator].valid) return callback()
        if (!iterator[kTest](iterator[kIterator].key)) return callback()

        // Must also include changes made in parallel to clear()
        this[kTree] = this[kTree].remove(iterator[kIterator].key)
        iterator[kIterator][iterator[kAdvance]]()
      }

      // Some time to breathe
      this.nextTick(loop)
    }

    this.nextTick(loop)
  }

  _iterator (options) {
    return new MemoryIterator(this, options)
  }

  _keys (options) {
    return new MemoryKeyIterator(this, options)
  }

  _values (options) {
    return new MemoryValueIterator(this, options)
  }
}

exports.h = MemoryLevel

// Use setImmediate() in Node.js to allow IO in between our callbacks
if (typeof process !== 'undefined' && !process.browser && typeof __webpack_require__.g !== 'undefined' && typeof __webpack_require__.g.setImmediate === 'function') {
  const setImmediate = __webpack_require__.g.setImmediate

  // Automatically applies to iterators, sublevels and chained batches as well
  MemoryLevel.prototype.nextTick = function (fn, ...args) {
    if (args.length === 0) {
      setImmediate(fn)
    } else {
      setImmediate(() => fn(...args))
    }
  }
}

function isRangeOption (k) {
  return rangeOptions.has(k)
}


/***/ }),

/***/ "../../node_modules/module-error/index.js":
/***/ ((module) => {



module.exports = class ModuleError extends Error {
  /**
   * @param {string} message Error message
   * @param {{ code?: string, cause?: Error, expected?: boolean, transient?: boolean }} [options]
   */
  constructor (message, options) {
    super(message || '')

    if (typeof options === 'object' && options !== null) {
      if (options.code) this.code = String(options.code)
      if (options.expected) this.expected = true
      if (options.transient) this.transient = true
      if (options.cause) this.cause = options.cause
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}


/***/ }),

/***/ "../../node_modules/pathval/index.js":
/***/ ((module) => {



/* !
 * Chai - pathval utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * @see https://github.com/logicalparadox/filtr
 * MIT Licensed
 */

/**
 * ### .hasProperty(object, name)
 *
 * This allows checking whether an object has own
 * or inherited from prototype chain named property.
 *
 * Basically does the same thing as the `in`
 * operator but works properly with null/undefined values
 * and other primitives.
 *
 *     var obj = {
 *         arr: ['a', 'b', 'c']
 *       , str: 'Hello'
 *     }
 *
 * The following would be the results.
 *
 *     hasProperty(obj, 'str');  // true
 *     hasProperty(obj, 'constructor');  // true
 *     hasProperty(obj, 'bar');  // false
 *
 *     hasProperty(obj.str, 'length'); // true
 *     hasProperty(obj.str, 1);  // true
 *     hasProperty(obj.str, 5);  // false
 *
 *     hasProperty(obj.arr, 'length');  // true
 *     hasProperty(obj.arr, 2);  // true
 *     hasProperty(obj.arr, 3);  // false
 *
 * @param {Object} object
 * @param {String|Symbol} name
 * @returns {Boolean} whether it exists
 * @namespace Utils
 * @name hasProperty
 * @api public
 */

function hasProperty(obj, name) {
  if (typeof obj === 'undefined' || obj === null) {
    return false;
  }

  // The `in` operator does not work with primitives.
  return name in Object(obj);
}

/* !
 * ## parsePath(path)
 *
 * Helper function used to parse string object
 * paths. Use in conjunction with `internalGetPathValue`.
 *
 *      var parsed = parsePath('myobject.property.subprop');
 *
 * ### Paths:
 *
 * * Can be infinitely deep and nested.
 * * Arrays are also valid using the formal `myobject.document[3].property`.
 * * Literal dots and brackets (not delimiter) must be backslash-escaped.
 *
 * @param {String} path
 * @returns {Object} parsed
 * @api private
 */

function parsePath(path) {
  var str = path.replace(/([^\\])\[/g, '$1.[');
  var parts = str.match(/(\\\.|[^.]+?)+/g);
  return parts.map(function mapMatches(value) {
    if (
      value === 'constructor' ||
      value === '__proto__' ||
      value === 'prototype'
    ) {
      return {};
    }
    var regexp = /^\[(\d+)\]$/;
    var mArr = regexp.exec(value);
    var parsed = null;
    if (mArr) {
      parsed = { i: parseFloat(mArr[1]) };
    } else {
      parsed = { p: value.replace(/\\([.[\]])/g, '$1') };
    }

    return parsed;
  });
}

/* !
 * ## internalGetPathValue(obj, parsed[, pathDepth])
 *
 * Helper companion function for `.parsePath` that returns
 * the value located at the parsed address.
 *
 *      var value = getPathValue(obj, parsed);
 *
 * @param {Object} object to search against
 * @param {Object} parsed definition from `parsePath`.
 * @param {Number} depth (nesting level) of the property we want to retrieve
 * @returns {Object|Undefined} value
 * @api private
 */

function internalGetPathValue(obj, parsed, pathDepth) {
  var temporaryValue = obj;
  var res = null;
  pathDepth = typeof pathDepth === 'undefined' ? parsed.length : pathDepth;

  for (var i = 0; i < pathDepth; i++) {
    var part = parsed[i];
    if (temporaryValue) {
      if (typeof part.p === 'undefined') {
        temporaryValue = temporaryValue[part.i];
      } else {
        temporaryValue = temporaryValue[part.p];
      }

      if (i === pathDepth - 1) {
        res = temporaryValue;
      }
    }
  }

  return res;
}

/* !
 * ## internalSetPathValue(obj, value, parsed)
 *
 * Companion function for `parsePath` that sets
 * the value located at a parsed address.
 *
 *  internalSetPathValue(obj, 'value', parsed);
 *
 * @param {Object} object to search and define on
 * @param {*} value to use upon set
 * @param {Object} parsed definition from `parsePath`
 * @api private
 */

function internalSetPathValue(obj, val, parsed) {
  var tempObj = obj;
  var pathDepth = parsed.length;
  var part = null;
  // Here we iterate through every part of the path
  for (var i = 0; i < pathDepth; i++) {
    var propName = null;
    var propVal = null;
    part = parsed[i];

    // If it's the last part of the path, we set the 'propName' value with the property name
    if (i === pathDepth - 1) {
      propName = typeof part.p === 'undefined' ? part.i : part.p;
      // Now we set the property with the name held by 'propName' on object with the desired val
      tempObj[propName] = val;
    } else if (typeof part.p !== 'undefined' && tempObj[part.p]) {
      tempObj = tempObj[part.p];
    } else if (typeof part.i !== 'undefined' && tempObj[part.i]) {
      tempObj = tempObj[part.i];
    } else {
      // If the obj doesn't have the property we create one with that name to define it
      var next = parsed[i + 1];
      // Here we set the name of the property which will be defined
      propName = typeof part.p === 'undefined' ? part.i : part.p;
      // Here we decide if this property will be an array or a new object
      propVal = typeof next.p === 'undefined' ? [] : {};
      tempObj[propName] = propVal;
      tempObj = tempObj[propName];
    }
  }
}

/**
 * ### .getPathInfo(object, path)
 *
 * This allows the retrieval of property info in an
 * object given a string path.
 *
 * The path info consists of an object with the
 * following properties:
 *
 * * parent - The parent object of the property referenced by `path`
 * * name - The name of the final property, a number if it was an array indexer
 * * value - The value of the property, if it exists, otherwise `undefined`
 * * exists - Whether the property exists or not
 *
 * @param {Object} object
 * @param {String} path
 * @returns {Object} info
 * @namespace Utils
 * @name getPathInfo
 * @api public
 */

function getPathInfo(obj, path) {
  var parsed = parsePath(path);
  var last = parsed[parsed.length - 1];
  var info = {
    parent:
      parsed.length > 1 ?
        internalGetPathValue(obj, parsed, parsed.length - 1) :
        obj,
    name: last.p || last.i,
    value: internalGetPathValue(obj, parsed),
  };
  info.exists = hasProperty(info.parent, info.name);

  return info;
}

/**
 * ### .getPathValue(object, path)
 *
 * This allows the retrieval of values in an
 * object given a string path.
 *
 *     var obj = {
 *         prop1: {
 *             arr: ['a', 'b', 'c']
 *           , str: 'Hello'
 *         }
 *       , prop2: {
 *             arr: [ { nested: 'Universe' } ]
 *           , str: 'Hello again!'
 *         }
 *     }
 *
 * The following would be the results.
 *
 *     getPathValue(obj, 'prop1.str'); // Hello
 *     getPathValue(obj, 'prop1.att[2]'); // b
 *     getPathValue(obj, 'prop2.arr[0].nested'); // Universe
 *
 * @param {Object} object
 * @param {String} path
 * @returns {Object} value or `undefined`
 * @namespace Utils
 * @name getPathValue
 * @api public
 */

function getPathValue(obj, path) {
  var info = getPathInfo(obj, path);
  return info.value;
}

/**
 * ### .setPathValue(object, path, value)
 *
 * Define the value in an object at a given string path.
 *
 * ```js
 * var obj = {
 *     prop1: {
 *         arr: ['a', 'b', 'c']
 *       , str: 'Hello'
 *     }
 *   , prop2: {
 *         arr: [ { nested: 'Universe' } ]
 *       , str: 'Hello again!'
 *     }
 * };
 * ```
 *
 * The following would be acceptable.
 *
 * ```js
 * var properties = require('tea-properties');
 * properties.set(obj, 'prop1.str', 'Hello Universe!');
 * properties.set(obj, 'prop1.arr[2]', 'B');
 * properties.set(obj, 'prop2.arr[0].nested.value', { hello: 'universe' });
 * ```
 *
 * @param {Object} object
 * @param {String} path
 * @param {Mixed} value
 * @api private
 */

function setPathValue(obj, path, val) {
  var parsed = parsePath(path);
  internalSetPathValue(obj, val, parsed);
  return obj;
}

module.exports = {
  hasProperty: hasProperty,
  getPathInfo: getPathInfo,
  getPathValue: getPathValue,
  setPathValue: setPathValue,
};


/***/ }),

/***/ "../../node_modules/queue-microtask/index.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*! queue-microtask. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
let promise

module.exports = typeof queueMicrotask === 'function'
  ? queueMicrotask.bind(typeof window !== 'undefined' ? window : __webpack_require__.g)
  // reuse resolved promise, and allocate it lazily
  : cb => (promise || (promise = Promise.resolve()))
    .then(cb)
    .catch(err => setTimeout(() => { throw err }, 0))


/***/ }),

/***/ "../../node_modules/rdf-data-factory/index.js":
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/BlankNode.js"), exports);
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/DataFactory.js"), exports);
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/DefaultGraph.js"), exports);
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/Literal.js"), exports);
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/NamedNode.js"), exports);
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/Quad.js"), exports);
__exportStar(__webpack_require__("../../node_modules/rdf-data-factory/lib/Variable.js"), exports);
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/BlankNode.js":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BlankNode = void 0;
/**
 * A term that represents an RDF blank node with a label.
 */
class BlankNode {
    constructor(value) {
        this.termType = 'BlankNode';
        this.value = value;
    }
    equals(other) {
        return !!other && other.termType === 'BlankNode' && other.value === this.value;
    }
}
exports.BlankNode = BlankNode;
//# sourceMappingURL=BlankNode.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/DataFactory.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DataFactory = void 0;
const BlankNode_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/BlankNode.js");
const DefaultGraph_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/DefaultGraph.js");
const Literal_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/Literal.js");
const NamedNode_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/NamedNode.js");
const Quad_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/Quad.js");
const Variable_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/Variable.js");
let dataFactoryCounter = 0;
/**
 * A factory for instantiating RDF terms and quads.
 */
class DataFactory {
    constructor(options) {
        this.blankNodeCounter = 0;
        options = options || {};
        this.blankNodePrefix = options.blankNodePrefix || `df_${dataFactoryCounter++}_`;
    }
    /**
     * @param value The IRI for the named node.
     * @return A new instance of NamedNode.
     * @see NamedNode
     */
    namedNode(value) {
        return new NamedNode_1.NamedNode(value);
    }
    /**
     * @param value The optional blank node identifier.
     * @return A new instance of BlankNode.
     *         If the `value` parameter is undefined a new identifier
     *         for the blank node is generated for each call.
     * @see BlankNode
     */
    blankNode(value) {
        return new BlankNode_1.BlankNode(value || `${this.blankNodePrefix}${this.blankNodeCounter++}`);
    }
    /**
     * @param value              The literal value.
     * @param languageOrDatatype The optional language or datatype.
     *                           If `languageOrDatatype` is a NamedNode,
     *                           then it is used for the value of `NamedNode.datatype`.
     *                           Otherwise `languageOrDatatype` is used for the value
     *                           of `NamedNode.language`.
     * @return A new instance of Literal.
     * @see Literal
     */
    literal(value, languageOrDatatype) {
        return new Literal_1.Literal(value, languageOrDatatype);
    }
    /**
     * This method is optional.
     * @param value The variable name
     * @return A new instance of Variable.
     * @see Variable
     */
    variable(value) {
        return new Variable_1.Variable(value);
    }
    /**
     * @return An instance of DefaultGraph.
     */
    defaultGraph() {
        return DefaultGraph_1.DefaultGraph.INSTANCE;
    }
    /**
     * @param subject   The quad subject term.
     * @param predicate The quad predicate term.
     * @param object    The quad object term.
     * @param graph     The quad graph term.
     * @return A new instance of Quad.
     * @see Quad
     */
    quad(subject, predicate, object, graph) {
        return new Quad_1.Quad(subject, predicate, object, graph || this.defaultGraph());
    }
    /**
     * Create a deep copy of the given term using this data factory.
     * @param original An RDF term.
     * @return A deep copy of the given term.
     */
    fromTerm(original) {
        // TODO: remove nasty any casts when this TS bug has been fixed:
        //  https://github.com/microsoft/TypeScript/issues/26933
        switch (original.termType) {
            case 'NamedNode':
                return this.namedNode(original.value);
            case 'BlankNode':
                return this.blankNode(original.value);
            case 'Literal':
                if (original.language) {
                    return this.literal(original.value, original.language);
                }
                if (!original.datatype.equals(Literal_1.Literal.XSD_STRING)) {
                    return this.literal(original.value, this.fromTerm(original.datatype));
                }
                return this.literal(original.value);
            case 'Variable':
                return this.variable(original.value);
            case 'DefaultGraph':
                return this.defaultGraph();
            case 'Quad':
                return this.quad(this.fromTerm(original.subject), this.fromTerm(original.predicate), this.fromTerm(original.object), this.fromTerm(original.graph));
        }
    }
    /**
     * Create a deep copy of the given quad using this data factory.
     * @param original An RDF quad.
     * @return A deep copy of the given quad.
     */
    fromQuad(original) {
        return this.fromTerm(original);
    }
    /**
     * Reset the internal blank node counter.
     */
    resetBlankNodeCounter() {
        this.blankNodeCounter = 0;
    }
}
exports.DataFactory = DataFactory;
//# sourceMappingURL=DataFactory.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/DefaultGraph.js":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DefaultGraph = void 0;
/**
 * A singleton term instance that represents the default graph.
 * It's only allowed to assign a DefaultGraph to the .graph property of a Quad.
 */
class DefaultGraph {
    constructor() {
        this.termType = 'DefaultGraph';
        this.value = '';
        // Private constructor
    }
    equals(other) {
        return !!other && other.termType === 'DefaultGraph';
    }
}
exports.DefaultGraph = DefaultGraph;
DefaultGraph.INSTANCE = new DefaultGraph();
//# sourceMappingURL=DefaultGraph.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/Literal.js":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Literal = void 0;
const NamedNode_1 = __webpack_require__("../../node_modules/rdf-data-factory/lib/NamedNode.js");
/**
 * A term that represents an RDF literal, containing a string with an optional language tag or datatype.
 */
class Literal {
    constructor(value, languageOrDatatype) {
        this.termType = 'Literal';
        this.value = value;
        if (typeof languageOrDatatype === 'string') {
            this.language = languageOrDatatype;
            this.datatype = Literal.RDF_LANGUAGE_STRING;
        }
        else if (languageOrDatatype) {
            this.language = '';
            this.datatype = languageOrDatatype;
        }
        else {
            this.language = '';
            this.datatype = Literal.XSD_STRING;
        }
    }
    equals(other) {
        return !!other && other.termType === 'Literal' && other.value === this.value &&
            other.language === this.language && other.datatype.equals(this.datatype);
    }
}
exports.Literal = Literal;
Literal.RDF_LANGUAGE_STRING = new NamedNode_1.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
Literal.XSD_STRING = new NamedNode_1.NamedNode('http://www.w3.org/2001/XMLSchema#string');
//# sourceMappingURL=Literal.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/NamedNode.js":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NamedNode = void 0;
/**
 * A term that contains an IRI.
 */
class NamedNode {
    constructor(value) {
        this.termType = 'NamedNode';
        this.value = value;
    }
    equals(other) {
        return !!other && other.termType === 'NamedNode' && other.value === this.value;
    }
}
exports.NamedNode = NamedNode;
//# sourceMappingURL=NamedNode.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/Quad.js":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Quad = void 0;
/**
 * An instance of DefaultGraph represents the default graph.
 * It's only allowed to assign a DefaultGraph to the .graph property of a Quad.
 */
class Quad {
    constructor(subject, predicate, object, graph) {
        this.termType = 'Quad';
        this.value = '';
        this.subject = subject;
        this.predicate = predicate;
        this.object = object;
        this.graph = graph;
    }
    equals(other) {
        // `|| !other.termType` is for backwards-compatibility with old factories without RDF* support.
        return !!other && (other.termType === 'Quad' || !other.termType) &&
            this.subject.equals(other.subject) &&
            this.predicate.equals(other.predicate) &&
            this.object.equals(other.object) &&
            this.graph.equals(other.graph);
    }
}
exports.Quad = Quad;
//# sourceMappingURL=Quad.js.map

/***/ }),

/***/ "../../node_modules/rdf-data-factory/lib/Variable.js":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Variable = void 0;
/**
 * A term that represents a variable.
 */
class Variable {
    constructor(value) {
        this.termType = 'Variable';
        this.value = value;
    }
    equals(other) {
        return !!other && other.termType === 'Variable' && other.value === this.value;
    }
}
exports.Variable = Variable;
//# sourceMappingURL=Variable.js.map

/***/ }),

/***/ "../../node_modules/run-parallel-limit/index.js":
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*! run-parallel-limit. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
module.exports = runParallelLimit

const queueMicrotask = __webpack_require__("../../node_modules/queue-microtask/index.js")

function runParallelLimit (tasks, limit, cb) {
  if (typeof limit !== 'number') throw new Error('second argument must be a Number')
  let results, len, pending, keys, isErrored
  let isSync = true
  let next

  if (Array.isArray(tasks)) {
    results = []
    pending = len = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = len = keys.length
  }

  function done (err) {
    function end () {
      if (cb) cb(err, results)
      cb = null
    }
    if (isSync) queueMicrotask(end)
    else end()
  }

  function each (i, err, result) {
    results[i] = result
    if (err) isErrored = true
    if (--pending === 0 || err) {
      done(err)
    } else if (!isErrored && next < len) {
      let key
      if (keys) {
        key = keys[next]
        next += 1
        tasks[key](function (err, result) { each(key, err, result) })
      } else {
        key = next
        next += 1
        tasks[key](function (err, result) { each(key, err, result) })
      }
    }
  }

  next = limit
  if (!pending) {
    // empty
    done(null)
  } else if (keys) {
    // object
    keys.some(function (key, i) {
      tasks[key](function (err, result) { each(key, err, result) })
      if (i === limit - 1) return true // early return
      return false
    })
  } else {
    // array
    tasks.some(function (task, i) {
      task(function (err, result) { each(i, err, result) })
      if (i === limit - 1) return true // early return
      return false
    })
  }

  isSync = false
}


/***/ }),

/***/ "../../node_modules/type-detect/type-detect.js":
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

(function (global, factory) {
	 true ? module.exports = factory() :
	0;
}(this, (function () { 'use strict';

/* !
 * type-detect
 * Copyright(c) 2013 jake luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
var promiseExists = typeof Promise === 'function';

/* eslint-disable no-undef */
var globalObject = typeof self === 'object' ? self : __webpack_require__.g; // eslint-disable-line id-blacklist

var symbolExists = typeof Symbol !== 'undefined';
var mapExists = typeof Map !== 'undefined';
var setExists = typeof Set !== 'undefined';
var weakMapExists = typeof WeakMap !== 'undefined';
var weakSetExists = typeof WeakSet !== 'undefined';
var dataViewExists = typeof DataView !== 'undefined';
var symbolIteratorExists = symbolExists && typeof Symbol.iterator !== 'undefined';
var symbolToStringTagExists = symbolExists && typeof Symbol.toStringTag !== 'undefined';
var setEntriesExists = setExists && typeof Set.prototype.entries === 'function';
var mapEntriesExists = mapExists && typeof Map.prototype.entries === 'function';
var setIteratorPrototype = setEntriesExists && Object.getPrototypeOf(new Set().entries());
var mapIteratorPrototype = mapEntriesExists && Object.getPrototypeOf(new Map().entries());
var arrayIteratorExists = symbolIteratorExists && typeof Array.prototype[Symbol.iterator] === 'function';
var arrayIteratorPrototype = arrayIteratorExists && Object.getPrototypeOf([][Symbol.iterator]());
var stringIteratorExists = symbolIteratorExists && typeof String.prototype[Symbol.iterator] === 'function';
var stringIteratorPrototype = stringIteratorExists && Object.getPrototypeOf(''[Symbol.iterator]());
var toStringLeftSliceLength = 8;
var toStringRightSliceLength = -1;
/**
 * ### typeOf (obj)
 *
 * Uses `Object.prototype.toString` to determine the type of an object,
 * normalising behaviour across engine versions & well optimised.
 *
 * @param {Mixed} object
 * @return {String} object type
 * @api public
 */
function typeDetect(obj) {
  /* ! Speed optimisation
   * Pre:
   *   string literal     x 3,039,035 ops/sec ±1.62% (78 runs sampled)
   *   boolean literal    x 1,424,138 ops/sec ±4.54% (75 runs sampled)
   *   number literal     x 1,653,153 ops/sec ±1.91% (82 runs sampled)
   *   undefined          x 9,978,660 ops/sec ±1.92% (75 runs sampled)
   *   function           x 2,556,769 ops/sec ±1.73% (77 runs sampled)
   * Post:
   *   string literal     x 38,564,796 ops/sec ±1.15% (79 runs sampled)
   *   boolean literal    x 31,148,940 ops/sec ±1.10% (79 runs sampled)
   *   number literal     x 32,679,330 ops/sec ±1.90% (78 runs sampled)
   *   undefined          x 32,363,368 ops/sec ±1.07% (82 runs sampled)
   *   function           x 31,296,870 ops/sec ±0.96% (83 runs sampled)
   */
  var typeofObj = typeof obj;
  if (typeofObj !== 'object') {
    return typeofObj;
  }

  /* ! Speed optimisation
   * Pre:
   *   null               x 28,645,765 ops/sec ±1.17% (82 runs sampled)
   * Post:
   *   null               x 36,428,962 ops/sec ±1.37% (84 runs sampled)
   */
  if (obj === null) {
    return 'null';
  }

  /* ! Spec Conformance
   * Test: `Object.prototype.toString.call(window)``
   *  - Node === "[object global]"
   *  - Chrome === "[object global]"
   *  - Firefox === "[object Window]"
   *  - PhantomJS === "[object Window]"
   *  - Safari === "[object Window]"
   *  - IE 11 === "[object Window]"
   *  - IE Edge === "[object Window]"
   * Test: `Object.prototype.toString.call(this)``
   *  - Chrome Worker === "[object global]"
   *  - Firefox Worker === "[object DedicatedWorkerGlobalScope]"
   *  - Safari Worker === "[object DedicatedWorkerGlobalScope]"
   *  - IE 11 Worker === "[object WorkerGlobalScope]"
   *  - IE Edge Worker === "[object WorkerGlobalScope]"
   */
  if (obj === globalObject) {
    return 'global';
  }

  /* ! Speed optimisation
   * Pre:
   *   array literal      x 2,888,352 ops/sec ±0.67% (82 runs sampled)
   * Post:
   *   array literal      x 22,479,650 ops/sec ±0.96% (81 runs sampled)
   */
  if (
    Array.isArray(obj) &&
    (symbolToStringTagExists === false || !(Symbol.toStringTag in obj))
  ) {
    return 'Array';
  }

  // Not caching existence of `window` and related properties due to potential
  // for `window` to be unset before tests in quasi-browser environments.
  if (typeof window === 'object' && window !== null) {
    /* ! Spec Conformance
     * (https://html.spec.whatwg.org/multipage/browsers.html#location)
     * WhatWG HTML$7.7.3 - The `Location` interface
     * Test: `Object.prototype.toString.call(window.location)``
     *  - IE <=11 === "[object Object]"
     *  - IE Edge <=13 === "[object Object]"
     */
    if (typeof window.location === 'object' && obj === window.location) {
      return 'Location';
    }

    /* ! Spec Conformance
     * (https://html.spec.whatwg.org/#document)
     * WhatWG HTML$3.1.1 - The `Document` object
     * Note: Most browsers currently adher to the W3C DOM Level 2 spec
     *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-26809268)
     *       which suggests that browsers should use HTMLTableCellElement for
     *       both TD and TH elements. WhatWG separates these.
     *       WhatWG HTML states:
     *         > For historical reasons, Window objects must also have a
     *         > writable, configurable, non-enumerable property named
     *         > HTMLDocument whose value is the Document interface object.
     * Test: `Object.prototype.toString.call(document)``
     *  - Chrome === "[object HTMLDocument]"
     *  - Firefox === "[object HTMLDocument]"
     *  - Safari === "[object HTMLDocument]"
     *  - IE <=10 === "[object Document]"
     *  - IE 11 === "[object HTMLDocument]"
     *  - IE Edge <=13 === "[object HTMLDocument]"
     */
    if (typeof window.document === 'object' && obj === window.document) {
      return 'Document';
    }

    if (typeof window.navigator === 'object') {
      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/multipage/webappapis.html#mimetypearray)
       * WhatWG HTML$8.6.1.5 - Plugins - Interface MimeTypeArray
       * Test: `Object.prototype.toString.call(navigator.mimeTypes)``
       *  - IE <=10 === "[object MSMimeTypesCollection]"
       */
      if (typeof window.navigator.mimeTypes === 'object' &&
          obj === window.navigator.mimeTypes) {
        return 'MimeTypeArray';
      }

      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/multipage/webappapis.html#pluginarray)
       * WhatWG HTML$8.6.1.5 - Plugins - Interface PluginArray
       * Test: `Object.prototype.toString.call(navigator.plugins)``
       *  - IE <=10 === "[object MSPluginsCollection]"
       */
      if (typeof window.navigator.plugins === 'object' &&
          obj === window.navigator.plugins) {
        return 'PluginArray';
      }
    }

    if ((typeof window.HTMLElement === 'function' ||
        typeof window.HTMLElement === 'object') &&
        obj instanceof window.HTMLElement) {
      /* ! Spec Conformance
      * (https://html.spec.whatwg.org/multipage/webappapis.html#pluginarray)
      * WhatWG HTML$4.4.4 - The `blockquote` element - Interface `HTMLQuoteElement`
      * Test: `Object.prototype.toString.call(document.createElement('blockquote'))``
      *  - IE <=10 === "[object HTMLBlockElement]"
      */
      if (obj.tagName === 'BLOCKQUOTE') {
        return 'HTMLQuoteElement';
      }

      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/#htmltabledatacellelement)
       * WhatWG HTML$4.9.9 - The `td` element - Interface `HTMLTableDataCellElement`
       * Note: Most browsers currently adher to the W3C DOM Level 2 spec
       *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-82915075)
       *       which suggests that browsers should use HTMLTableCellElement for
       *       both TD and TH elements. WhatWG separates these.
       * Test: Object.prototype.toString.call(document.createElement('td'))
       *  - Chrome === "[object HTMLTableCellElement]"
       *  - Firefox === "[object HTMLTableCellElement]"
       *  - Safari === "[object HTMLTableCellElement]"
       */
      if (obj.tagName === 'TD') {
        return 'HTMLTableDataCellElement';
      }

      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/#htmltableheadercellelement)
       * WhatWG HTML$4.9.9 - The `td` element - Interface `HTMLTableHeaderCellElement`
       * Note: Most browsers currently adher to the W3C DOM Level 2 spec
       *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-82915075)
       *       which suggests that browsers should use HTMLTableCellElement for
       *       both TD and TH elements. WhatWG separates these.
       * Test: Object.prototype.toString.call(document.createElement('th'))
       *  - Chrome === "[object HTMLTableCellElement]"
       *  - Firefox === "[object HTMLTableCellElement]"
       *  - Safari === "[object HTMLTableCellElement]"
       */
      if (obj.tagName === 'TH') {
        return 'HTMLTableHeaderCellElement';
      }
    }
  }

  /* ! Speed optimisation
  * Pre:
  *   Float64Array       x 625,644 ops/sec ±1.58% (80 runs sampled)
  *   Float32Array       x 1,279,852 ops/sec ±2.91% (77 runs sampled)
  *   Uint32Array        x 1,178,185 ops/sec ±1.95% (83 runs sampled)
  *   Uint16Array        x 1,008,380 ops/sec ±2.25% (80 runs sampled)
  *   Uint8Array         x 1,128,040 ops/sec ±2.11% (81 runs sampled)
  *   Int32Array         x 1,170,119 ops/sec ±2.88% (80 runs sampled)
  *   Int16Array         x 1,176,348 ops/sec ±5.79% (86 runs sampled)
  *   Int8Array          x 1,058,707 ops/sec ±4.94% (77 runs sampled)
  *   Uint8ClampedArray  x 1,110,633 ops/sec ±4.20% (80 runs sampled)
  * Post:
  *   Float64Array       x 7,105,671 ops/sec ±13.47% (64 runs sampled)
  *   Float32Array       x 5,887,912 ops/sec ±1.46% (82 runs sampled)
  *   Uint32Array        x 6,491,661 ops/sec ±1.76% (79 runs sampled)
  *   Uint16Array        x 6,559,795 ops/sec ±1.67% (82 runs sampled)
  *   Uint8Array         x 6,463,966 ops/sec ±1.43% (85 runs sampled)
  *   Int32Array         x 5,641,841 ops/sec ±3.49% (81 runs sampled)
  *   Int16Array         x 6,583,511 ops/sec ±1.98% (80 runs sampled)
  *   Int8Array          x 6,606,078 ops/sec ±1.74% (81 runs sampled)
  *   Uint8ClampedArray  x 6,602,224 ops/sec ±1.77% (83 runs sampled)
  */
  var stringTag = (symbolToStringTagExists && obj[Symbol.toStringTag]);
  if (typeof stringTag === 'string') {
    return stringTag;
  }

  var objPrototype = Object.getPrototypeOf(obj);
  /* ! Speed optimisation
  * Pre:
  *   regex literal      x 1,772,385 ops/sec ±1.85% (77 runs sampled)
  *   regex constructor  x 2,143,634 ops/sec ±2.46% (78 runs sampled)
  * Post:
  *   regex literal      x 3,928,009 ops/sec ±0.65% (78 runs sampled)
  *   regex constructor  x 3,931,108 ops/sec ±0.58% (84 runs sampled)
  */
  if (objPrototype === RegExp.prototype) {
    return 'RegExp';
  }

  /* ! Speed optimisation
  * Pre:
  *   date               x 2,130,074 ops/sec ±4.42% (68 runs sampled)
  * Post:
  *   date               x 3,953,779 ops/sec ±1.35% (77 runs sampled)
  */
  if (objPrototype === Date.prototype) {
    return 'Date';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-promise.prototype-@@tostringtag)
   * ES6$25.4.5.4 - Promise.prototype[@@toStringTag] should be "Promise":
   * Test: `Object.prototype.toString.call(Promise.resolve())``
   *  - Chrome <=47 === "[object Object]"
   *  - Edge <=20 === "[object Object]"
   *  - Firefox 29-Latest === "[object Promise]"
   *  - Safari 7.1-Latest === "[object Promise]"
   */
  if (promiseExists && objPrototype === Promise.prototype) {
    return 'Promise';
  }

  /* ! Speed optimisation
  * Pre:
  *   set                x 2,222,186 ops/sec ±1.31% (82 runs sampled)
  * Post:
  *   set                x 4,545,879 ops/sec ±1.13% (83 runs sampled)
  */
  if (setExists && objPrototype === Set.prototype) {
    return 'Set';
  }

  /* ! Speed optimisation
  * Pre:
  *   map                x 2,396,842 ops/sec ±1.59% (81 runs sampled)
  * Post:
  *   map                x 4,183,945 ops/sec ±6.59% (82 runs sampled)
  */
  if (mapExists && objPrototype === Map.prototype) {
    return 'Map';
  }

  /* ! Speed optimisation
  * Pre:
  *   weakset            x 1,323,220 ops/sec ±2.17% (76 runs sampled)
  * Post:
  *   weakset            x 4,237,510 ops/sec ±2.01% (77 runs sampled)
  */
  if (weakSetExists && objPrototype === WeakSet.prototype) {
    return 'WeakSet';
  }

  /* ! Speed optimisation
  * Pre:
  *   weakmap            x 1,500,260 ops/sec ±2.02% (78 runs sampled)
  * Post:
  *   weakmap            x 3,881,384 ops/sec ±1.45% (82 runs sampled)
  */
  if (weakMapExists && objPrototype === WeakMap.prototype) {
    return 'WeakMap';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-dataview.prototype-@@tostringtag)
   * ES6$24.2.4.21 - DataView.prototype[@@toStringTag] should be "DataView":
   * Test: `Object.prototype.toString.call(new DataView(new ArrayBuffer(1)))``
   *  - Edge <=13 === "[object Object]"
   */
  if (dataViewExists && objPrototype === DataView.prototype) {
    return 'DataView';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%mapiteratorprototype%-@@tostringtag)
   * ES6$23.1.5.2.2 - %MapIteratorPrototype%[@@toStringTag] should be "Map Iterator":
   * Test: `Object.prototype.toString.call(new Map().entries())``
   *  - Edge <=13 === "[object Object]"
   */
  if (mapExists && objPrototype === mapIteratorPrototype) {
    return 'Map Iterator';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%setiteratorprototype%-@@tostringtag)
   * ES6$23.2.5.2.2 - %SetIteratorPrototype%[@@toStringTag] should be "Set Iterator":
   * Test: `Object.prototype.toString.call(new Set().entries())``
   *  - Edge <=13 === "[object Object]"
   */
  if (setExists && objPrototype === setIteratorPrototype) {
    return 'Set Iterator';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%arrayiteratorprototype%-@@tostringtag)
   * ES6$22.1.5.2.2 - %ArrayIteratorPrototype%[@@toStringTag] should be "Array Iterator":
   * Test: `Object.prototype.toString.call([][Symbol.iterator]())``
   *  - Edge <=13 === "[object Object]"
   */
  if (arrayIteratorExists && objPrototype === arrayIteratorPrototype) {
    return 'Array Iterator';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%stringiteratorprototype%-@@tostringtag)
   * ES6$21.1.5.2.2 - %StringIteratorPrototype%[@@toStringTag] should be "String Iterator":
   * Test: `Object.prototype.toString.call(''[Symbol.iterator]())``
   *  - Edge <=13 === "[object Object]"
   */
  if (stringIteratorExists && objPrototype === stringIteratorPrototype) {
    return 'String Iterator';
  }

  /* ! Speed optimisation
  * Pre:
  *   object from null   x 2,424,320 ops/sec ±1.67% (76 runs sampled)
  * Post:
  *   object from null   x 5,838,000 ops/sec ±0.99% (84 runs sampled)
  */
  if (objPrototype === null) {
    return 'Object';
  }

  return Object
    .prototype
    .toString
    .call(obj)
    .slice(toStringLeftSliceLength, toStringRightSliceLength);
}

return typeDetect;

})));


/***/ }),

/***/ "?7779":
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "../../dist/esm/get/index.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "M": () => (/* binding */ getStream),
/* harmony export */   "w": () => (/* binding */ getApproximateSize)
/* harmony export */ });
/* harmony import */ var _types_index_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/types/index.js");
/* harmony import */ var _utils_stuff_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/utils/constants.js");
/* harmony import */ var _leveliterator_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__("../../dist/esm/get/leveliterator.js");
/* harmony import */ var _serialization_index_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/serialization/index.js");
/* harmony import */ var _sortingiterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__("../../dist/esm/get/sortingiterator.js");
/* harmony import */ var _serialization_utils_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__("../../dist/esm/serialization/utils.js");







const SORTING_KEY = Symbol();
const compareSortableQuadsReverse = (left, right) => {
    return left[SORTING_KEY] > right[SORTING_KEY] ? -1 : 1;
};
const compareSortableQuads = (left, right) => {
    return left[SORTING_KEY] > right[SORTING_KEY] ? 1 : -1;
};
const emitSortableQuad = (item) => item;
const getLevelQueryForIndex = (pattern, index, prefixes, opts) => {
    const indexQuery = (0,_serialization_index_js__WEBPACK_IMPORTED_MODULE_3__/* .writePattern */ .C1)(pattern, index, prefixes);
    if (indexQuery === null) {
        return null;
    }
    const levelOpts = {
        [indexQuery.gte ? 'gte' : 'gt']: indexQuery.gt,
        [indexQuery.lte ? 'lte' : 'lt']: indexQuery.lt,
        keys: true,
        values: true,
        keyEncoding: 'utf8',
        valueEncoding: 'view',
    };
    if (typeof opts.limit === 'number') {
        levelOpts.limit = opts.limit;
    }
    if (typeof opts.reverse === 'boolean') {
        levelOpts.reverse = opts.reverse;
    }
    return { level: levelOpts, order: indexQuery.order, index: indexQuery.index };
};
const getLevelQuery = (pattern, indexes, prefixes, opts) => {
    for (let i = 0, index; i < indexes.length; i += 1) {
        index = indexes[i];
        const levelQuery = getLevelQueryForIndex(pattern, index, prefixes, opts);
        if (levelQuery !== null && (!opts.order || (0,_utils_stuff_js__WEBPACK_IMPORTED_MODULE_1__/* .arrStartsWith */ .Jp)(levelQuery.order, opts.order))) {
            return levelQuery;
        }
    }
    return null;
};
const getStream = async (store, pattern, opts) => {
    const { dataFactory, prefixes, indexes } = store;
    const levelQueryFull = getLevelQuery(pattern, indexes, prefixes, opts);
    if (levelQueryFull !== null) {
        const { index, level, order } = levelQueryFull;
        let iterator = new _leveliterator_js__WEBPACK_IMPORTED_MODULE_5__/* .LevelIterator */ .g(store.db.iterator(level), (key, value) => {
            return _serialization_index_js__WEBPACK_IMPORTED_MODULE_3__/* .quadReader.read */ .E9.read(key, index.prefix.length, (0,_serialization_utils_js__WEBPACK_IMPORTED_MODULE_6__/* .viewUint8ArrayAsUint16Array */ .ch)(value), 0, index.terms, dataFactory, prefixes);
        });
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.QUADS */ .X.QUADS, order, iterator, index: index.terms, resorted: false };
    }
    const levelQueryNoOpts = getLevelQuery(pattern, indexes, prefixes, _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .emptyObject */ .FD);
    if (levelQueryNoOpts !== null) {
        const { index, level, order } = levelQueryNoOpts;
        let iterator = new _leveliterator_js__WEBPACK_IMPORTED_MODULE_5__/* .LevelIterator */ .g(store.db.iterator(level), (key, value) => {
            return _serialization_index_js__WEBPACK_IMPORTED_MODULE_3__/* .quadReader.read */ .E9.read(key, index.prefix.length, (0,_serialization_utils_js__WEBPACK_IMPORTED_MODULE_6__/* .viewUint8ArrayAsUint16Array */ .ch)(value), 0, index.terms, dataFactory, prefixes);
        });
        if (typeof opts.order !== 'undefined' && !(0,_utils_stuff_js__WEBPACK_IMPORTED_MODULE_1__/* .arrStartsWith */ .Jp)(opts.order, order)) {
            const digest = (item) => {
                item[SORTING_KEY] = _serialization_index_js__WEBPACK_IMPORTED_MODULE_3__/* .quadWriter.write */ .LT.write('', undefined, 0, item, opts.order, prefixes) + _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr;
                return item;
            };
            const compare = opts.reverse === true ? compareSortableQuadsReverse : compareSortableQuads;
            iterator = new _sortingiterator_js__WEBPACK_IMPORTED_MODULE_4__/* .SortingIterator */ .B(iterator, compare, digest, emitSortableQuad);
            if (typeof opts.limit !== 'undefined') {
                const onEndOrError = function () {
                    this.removeListener('end', onEndOrError);
                    this.removeListener('error', onEndOrError);
                    this.destroy();
                };
                iterator = iterator.take(opts.limit)
                    .on('end', onEndOrError)
                    .on('error', onEndOrError);
            }
        }
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.QUADS */ .X.QUADS, order: opts.order || order, iterator, index: index.terms, resorted: true };
    }
    throw new Error(`No index compatible with pattern ${JSON.stringify(pattern)} and options ${JSON.stringify(opts)}`);
};
const getApproximateSize = async (store, pattern, opts) => {
    if (!store.db.approximateSize) {
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.APPROXIMATE_SIZE */ .X.APPROXIMATE_SIZE, approximateSize: Infinity };
    }
    const { indexes, prefixes } = store;
    const levelQuery = getLevelQuery(pattern, indexes, prefixes, opts);
    if (levelQuery === null) {
        throw new Error(`No index compatible with pattern ${JSON.stringify(pattern)} and options ${JSON.stringify(opts)}`);
    }
    const { level } = levelQuery;
    const start = level.gte || level.gt;
    const end = level.lte || level.lt;
    return new Promise((resolve, reject) => {
        store.db.approximateSize(start, end, (err, approximateSize) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({
                type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.APPROXIMATE_SIZE */ .X.APPROXIMATE_SIZE,
                approximateSize: Math.max(1, approximateSize),
            });
        });
    });
};
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "../../dist/esm/get/leveliterator.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "g": () => (/* binding */ LevelIterator)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");

class LevelIterator extends asynciterator__WEBPACK_IMPORTED_MODULE_0__/* .BufferedIterator */ .Tp {
    level;
    mapFn;
    levelEnded;
    constructor(levelIterator, mapper) {
        super({ maxBufferSize: 64 });
        this.mapFn = mapper;
        this.level = levelIterator;
        this.levelEnded = false;
    }
    _read(qty, done) {
        const state = { remaining: qty };
        state.next = this._onNextValue.bind(this, state, done);
        this.level.next(state.next);
    }
    _onNextValue(state, done, err, key, value) {
        if (err) {
            done(err);
            return;
        }
        if (key === undefined && value === undefined) {
            this.close();
            this.levelEnded = true;
            done();
            return;
        }
        this._push(this.mapFn(key, value));
        state.remaining -= 1;
        if (state.remaining === 0) {
            done();
            return;
        }
        this.level.next(state.next);
    }
    ;
    _endLevel(cb) {
        if (this.levelEnded) {
            cb();
            return;
        }
        this.level.close((err) => {
            if (!err) {
                this.levelEnded = true;
            }
            cb(err);
        });
    }
    _end(destroy) {
        if (this.ended) {
            return;
        }
        super._end(destroy);
        this._endLevel((endErr) => {
            if (endErr) {
                this.emit('error', endErr);
            }
        });
    }
    _destroy(cause, cb) {
        if (this.destroyed) {
            cb();
            return;
        }
        this._endLevel((endErr) => {
            if (endErr) {
                cb(endErr);
                return;
            }
            super._destroy(cause, cb);
        });
    }
}
//# sourceMappingURL=leveliterator.js.map

/***/ }),

/***/ "../../dist/esm/get/sortingiterator.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "B": () => (/* binding */ SortingIterator)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");


let sortedSetImportErr;
let SortedSet = class {
    constructor() {
        throw new Error(`Failed to require module js-sorted-set: ${sortedSetImportErr?.message}`);
    }
};
Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, "../../node_modules/js-sorted-set/sorted-set.js", 19))
    .then((_) => { SortedSet = _.default; })
    .catch((err) => { sortedSetImportErr = err; });
class SortingIterator extends asynciterator__WEBPACK_IMPORTED_MODULE_1__/* .AsyncIterator */ .rG {
    constructor(source, compare, digest, emit) {
        super();
        let iterator;
        const startBuffering = () => {
            const set = new SortedSet({ comparator: compare });
            const cleanup = () => {
                source.removeListener('data', onData);
                source.removeListener('error', onError);
                source.removeListener('end', onEnd);
                source.destroy();
            };
            const onData = (item) => {
                set.insert(digest(item));
            };
            const onError = (err) => {
                cleanup();
                this.emit('error', err);
            };
            const onEnd = () => {
                cleanup();
                iterator = set.beginIterator();
                this.readable = true;
            };
            source.on('data', onData);
            source.on('error', onError);
            source.on('end', onEnd);
        };
        this.read = () => {
            if (iterator) {
                const value = iterator.value();
                if (value === null) {
                    this.close();
                    return null;
                }
                iterator = iterator.next();
                return emit(value);
            }
            this.readable = false;
            return null;
        };
        _utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .RESOLVED.then */ .XL.then(startBuffering).catch((err) => {
            _utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .RESOLVED.then */ .XL.then(() => this.emit('error', err));
        });
    }
}
//# sourceMappingURL=sortingiterator.js.map

/***/ }),

/***/ "../../dist/esm/quadstore.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "T": () => (/* binding */ Quadstore)
/* harmony export */ });
/* harmony import */ var _types_index_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/types/index.js");
/* harmony import */ var events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/events/events.js");
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _utils_stuff_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/utils/constants.js");
/* harmony import */ var _utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__("../../dist/esm/utils/consumeonebyone.js");
/* harmony import */ var _utils_consumeinbatches_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__("../../dist/esm/utils/consumeinbatches.js");
/* harmony import */ var _utils_uid_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__("../../dist/esm/utils/uid.js");
/* harmony import */ var _get_index_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__("../../dist/esm/get/index.js");
/* harmony import */ var _scope_index_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__("../../dist/esm/scope/index.js");
/* harmony import */ var _serialization_quads_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__("../../dist/esm/serialization/quads.js");
/* harmony import */ var _serialization_utils_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__("../../dist/esm/serialization/utils.js");













class Quadstore {
    db;
    indexes;
    id;
    prefixes;
    dataFactory;
    constructor(opts) {
        (0,_utils_stuff_js__WEBPACK_IMPORTED_MODULE_2__/* .ensureAbstractLevel */ .gG)(opts.backend, '"opts.backend"');
        this.dataFactory = opts.dataFactory;
        this.db = opts.backend;
        this.indexes = [];
        this.id = (0,_utils_uid_js__WEBPACK_IMPORTED_MODULE_4__/* .uid */ .h)();
        (opts.indexes || _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .defaultIndexes */ .yw)
            .forEach((index) => this._addIndex(index));
        this.prefixes = opts.prefixes || {
            expandTerm: term => term,
            compactIri: iri => iri,
        };
    }
    ensureReady() {
        if (this.db.status !== 'open') {
            throw new Error(`Store is not ready (status: "${this.db.status}"). Did you call store.open()?`);
        }
    }
    async open() {
        if (this.db.status !== 'open') {
            await this.db.open();
        }
    }
    async close() {
        if (this.db.status !== 'closed') {
            await this.db.close();
        }
    }
    toString() {
        return this.toJSON();
    }
    toJSON() {
        return `[object ${this.constructor.name}::${this.id}]`;
    }
    _addIndex(terms) {
        const name = terms.map(t => t.charAt(0).toUpperCase()).join('');
        this.indexes.push({
            terms,
            prefix: name + _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .separator */ .kr,
        });
    }
    async clear() {
        if (typeof this.db.clear === 'function') {
            return new Promise((resolve, reject) => {
                this.db.clear((err) => {
                    err ? reject(err) : resolve();
                });
            });
        }
        await this.delStream((await this.getStream({})).iterator, { batchSize: 20 });
    }
    match(subject, predicate, object, graph, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        if (subject && subject.termType === 'Literal') {
            return new asynciterator__WEBPACK_IMPORTED_MODULE_8__/* .EmptyIterator */ .K0();
        }
        const pattern = { subject, predicate, object, graph };
        return (0,asynciterator__WEBPACK_IMPORTED_MODULE_8__/* .wrap */ .re)(this.getStream(pattern, opts).then(results => results.iterator));
    }
    async countQuads(subject, predicate, object, graph, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        if (subject && subject.termType === 'Literal') {
            return 0;
        }
        const pattern = { subject, predicate, object, graph };
        const results = await this.getApproximateSize(pattern, opts);
        return results.approximateSize;
    }
    import(source) {
        const emitter = new events__WEBPACK_IMPORTED_MODULE_1__.EventEmitter();
        this.putStream(source, {})
            .then(() => { emitter.emit('end'); })
            .catch((err) => { emitter.emit('error', err); });
        return emitter;
    }
    remove(source) {
        const emitter = new events__WEBPACK_IMPORTED_MODULE_1__.EventEmitter();
        this.delStream(source, {})
            .then(() => emitter.emit('end'))
            .catch((err) => emitter.emit('error', err));
        return emitter;
    }
    removeMatches(subject, predicate, object, graph, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        const source = this.match(subject, predicate, object, graph, opts);
        return this.remove(source);
    }
    deleteGraph(graph) {
        return this.removeMatches(undefined, undefined, undefined, graph);
    }
    async getApproximateSize(pattern, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        await this.ensureReady();
        return await (0,_get_index_js__WEBPACK_IMPORTED_MODULE_5__/* .getApproximateSize */ .w)(this, pattern, opts);
    }
    _batchPut(quad, value, baseValueOffset, batch) {
        const { indexes } = this;
        for (let i = 0, il = indexes.length, index, valueOffset; i < il; i += 1) {
            valueOffset = baseValueOffset + i * 16;
            index = indexes[i];
            const key = _serialization_quads_js__WEBPACK_IMPORTED_MODULE_7__/* .quadWriter.write */ .L.write(index.prefix, value, valueOffset, quad, index.terms, this.prefixes);
            batch = batch.put(key, (0,_serialization_utils_js__WEBPACK_IMPORTED_MODULE_9__/* .viewUint16ArrayAsUint8Array */ .wU)(value, valueOffset, 16), _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .levelPutOpts */ .Is);
        }
        return batch;
    }
    async put(quad, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const { indexes, db } = this;
        let batch = db.batch();
        if (opts.scope) {
            quad = opts.scope.parseQuad(quad, batch);
        }
        const value = new Uint16Array(16 * indexes.length);
        this._batchPut(quad, value, 0, batch);
        await this.writeBatch(batch, opts);
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async multiPut(quads, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const { indexes, db } = this;
        const value = new Uint16Array(16 * indexes.length * quads.length);
        let valueOffset = 0;
        let batch = db.batch();
        for (let q = 0, ql = quads.length, quad; q < ql; q += 1) {
            quad = quads[q];
            valueOffset = q * indexes.length * 16;
            if (opts.scope) {
                quad = opts.scope.parseQuad(quad, batch);
            }
            this._batchPut(quad, value, valueOffset, batch);
        }
        await this.writeBatch(batch, opts);
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    _batchDel(quad, batch) {
        const { indexes } = this;
        for (let i = 0, il = indexes.length, index; i < il; i += 1) {
            index = indexes[i];
            const key = _serialization_quads_js__WEBPACK_IMPORTED_MODULE_7__/* .quadWriter.write */ .L.write(index.prefix, undefined, 0, quad, index.terms, this.prefixes);
            batch = batch.del(key, _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .levelDelOpts */ .P6);
        }
        return batch;
    }
    async del(quad, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const batch = this.db.batch();
        this._batchDel(quad, batch);
        await this.writeBatch(batch, opts);
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async multiDel(quads, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const batch = this.db.batch();
        for (let q = 0, ql = quads.length, quad; q < ql; q += 1) {
            quad = quads[q];
            this._batchDel(quad, batch);
        }
        await this.writeBatch(batch, opts);
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async patch(oldQuad, newQuad, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const { indexes, db } = this;
        const batch = db.batch();
        this._batchDel(oldQuad, batch);
        const value = new Uint16Array(16 * indexes.length);
        this._batchPut(newQuad, value, 0, batch);
        await this.writeBatch(batch, opts);
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async multiPatch(oldQuads, newQuads, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const { indexes, db } = this;
        let batch = db.batch();
        for (let oq = 0, oql = oldQuads.length, oldQuad; oq < oql; oq += 1) {
            oldQuad = oldQuads[oq];
            this._batchDel(oldQuad, batch);
        }
        const value = new Uint16Array(16 * indexes.length * newQuads.length);
        let valueOffset = 0;
        for (let nq = 0, nql = newQuads.length, newQuad; nq < nql; nq += 1) {
            valueOffset = nq * indexes.length * 16;
            newQuad = newQuads[nq];
            this._batchPut(newQuad, value, valueOffset, batch);
        }
        await this.writeBatch(batch, opts);
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async writeBatch(batch, opts) {
        if (opts.preWrite) {
            await opts.preWrite(batch);
        }
        await batch.write();
    }
    async get(pattern, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const results = await this.getStream(pattern, opts);
        const items = await (0,_utils_stuff_js__WEBPACK_IMPORTED_MODULE_2__/* .streamToArray */ .an)(results.iterator);
        return {
            items,
            type: results.type,
            order: results.order,
            index: results.index,
            resorted: results.resorted,
        };
    }
    async getStream(pattern, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        return await (0,_get_index_js__WEBPACK_IMPORTED_MODULE_5__/* .getStream */ .M)(this, pattern, opts);
    }
    async putStream(source, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const batchSize = opts.batchSize || 1;
        if (batchSize === 1) {
            await (0,_utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_10__/* .consumeOneByOne */ ._)(source, quad => this.put(quad, opts));
        }
        else {
            await (0,_utils_consumeinbatches_js__WEBPACK_IMPORTED_MODULE_11__/* .consumeInBatches */ .f)(source, batchSize, quads => this.multiPut(quads, opts));
        }
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async delStream(source, opts = _utils_constants_js__WEBPACK_IMPORTED_MODULE_3__/* .emptyObject */ .FD) {
        this.ensureReady();
        const batchSize = opts.batchSize || 1;
        if (batchSize === 1) {
            await (0,_utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_10__/* .consumeOneByOne */ ._)(source, quad => this.del(quad));
        }
        else {
            await (0,_utils_consumeinbatches_js__WEBPACK_IMPORTED_MODULE_11__/* .consumeInBatches */ .f)(source, batchSize, quads => this.multiDel(quads));
        }
        return { type: _types_index_js__WEBPACK_IMPORTED_MODULE_0__/* .ResultType.VOID */ .X.VOID };
    }
    async initScope() {
        await this.ensureReady();
        return await _scope_index_js__WEBPACK_IMPORTED_MODULE_6__/* .Scope.init */ .s.init(this);
    }
    async loadScope(scopeId) {
        await this.ensureReady();
        return await _scope_index_js__WEBPACK_IMPORTED_MODULE_6__/* .Scope.load */ .s.load(this, scopeId);
    }
    async deleteScope(scopeId) {
        await this.ensureReady();
        await _scope_index_js__WEBPACK_IMPORTED_MODULE_6__/* .Scope["delete"] */ .s["delete"](this, scopeId);
    }
    async deleteAllScopes() {
        await this.ensureReady();
        await _scope_index_js__WEBPACK_IMPORTED_MODULE_6__/* .Scope["delete"] */ .s["delete"](this);
    }
}
//# sourceMappingURL=quadstore.js.map

/***/ }),

/***/ "../../dist/esm/scope/index.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "s": () => (/* binding */ Scope)
/* harmony export */ });
/* harmony import */ var _get_leveliterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/get/leveliterator.js");
/* harmony import */ var _utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/utils/consumeonebyone.js");
/* harmony import */ var _utils_uid_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/uid.js");
/* harmony import */ var _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/utils/constants.js");




class Scope {
    id;
    blankNodes;
    factory;
    static async init(store) {
        return new Scope(store.dataFactory, (0,_utils_uid_js__WEBPACK_IMPORTED_MODULE_0__/* .uid */ .h)(), new Map());
    }
    static async load(store, scopeId) {
        const levelOpts = Scope.getLevelIteratorOpts(false, true, scopeId);
        const iterator = new _get_leveliterator_js__WEBPACK_IMPORTED_MODULE_2__/* .LevelIterator */ .g(store.db.iterator(levelOpts), (key, value) => value);
        const blankNodes = new Map();
        const { dataFactory: factory } = store;
        await (0,_utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_3__/* .consumeOneByOne */ ._)(iterator, (value) => {
            const { originalLabel, randomLabel } = JSON.parse(value);
            blankNodes.set(originalLabel, factory.blankNode(randomLabel));
        });
        return new Scope(factory, scopeId, blankNodes);
    }
    static async delete(store, scopeId) {
        const batch = store.db.batch();
        const levelOpts = Scope.getLevelIteratorOpts(true, false, scopeId);
        const iterator = new _get_leveliterator_js__WEBPACK_IMPORTED_MODULE_2__/* .LevelIterator */ .g(store.db.iterator(levelOpts), (key, value) => key);
        await (0,_utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_3__/* .consumeOneByOne */ ._)(iterator, (key) => {
            batch.del(key);
        });
        await batch.write();
    }
    static getLevelIteratorOpts(keys, values, scopeId) {
        const gte = scopeId
            ? `SCOPE${_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr}${scopeId}${_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr}`
            : `SCOPE${_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr}`;
        return {
            keys,
            values,
            keyEncoding: 'utf8',
            valueEncoding: 'utf8',
            gte,
            lte: `${gte}${_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .boundary */ .M0}`,
        };
    }
    static addMappingToLevelBatch(scopeId, batch, originalLabel, randomLabel) {
        batch.put(`SCOPE${_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr}${scopeId}${_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr}${originalLabel}`, JSON.stringify({ originalLabel, randomLabel }));
    }
    constructor(factory, id, blankNodes) {
        this.blankNodes = blankNodes;
        this.factory = factory;
        this.id = id;
    }
    parseBlankNode(node, batch) {
        let cachedNode = this.blankNodes.get(node.value);
        if (!cachedNode) {
            cachedNode = this.factory.blankNode((0,_utils_uid_js__WEBPACK_IMPORTED_MODULE_0__/* .uid */ .h)());
            this.blankNodes.set(node.value, cachedNode);
            Scope.addMappingToLevelBatch(this.id, batch, node.value, cachedNode.value);
        }
        return cachedNode;
    }
    parseSubject(node, batch) {
        switch (node.termType) {
            case 'BlankNode':
                return this.parseBlankNode(node, batch);
            default:
                return node;
        }
    }
    parseObject(node, batch) {
        switch (node.termType) {
            case 'BlankNode':
                return this.parseBlankNode(node, batch);
            default:
                return node;
        }
    }
    parseGraph(node, batch) {
        switch (node.termType) {
            case 'BlankNode':
                return this.parseBlankNode(node, batch);
            default:
                return node;
        }
    }
    parseQuad(quad, batch) {
        return this.factory.quad(this.parseSubject(quad.subject, batch), quad.predicate, this.parseObject(quad.object, batch), this.parseGraph(quad.graph, batch));
    }
}
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "../../dist/esm/serialization/fpstring.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "c": () => (/* binding */ encode)
/* harmony export */ });
const join = (encodingCase, exponent, mantissa) => {
    let r = '' + encodingCase;
    if (exponent < 10) {
        r += '00' + exponent;
    }
    else if (exponent < 100) {
        r += '0' + exponent;
    }
    else {
        r += exponent;
    }
    r += mantissa.toFixed(17);
    return r;
};
const ZERO = join(3, 0, 0);
const NEG_INF = join(0, 0, 0);
const POS_INF = join(6, 0, 0);
const encode = (stringOrNumber) => {
    let mantissa = typeof stringOrNumber !== 'number'
        ? parseFloat(stringOrNumber)
        : stringOrNumber;
    if (Number.isNaN(mantissa)) {
        throw new Error(`Cannot serialize NaN`);
    }
    if (mantissa === -Infinity) {
        return NEG_INF;
    }
    if (mantissa === Infinity) {
        return POS_INF;
    }
    if (mantissa === 0) {
        return ZERO;
    }
    let exponent = 0;
    let sign = 0;
    if (mantissa < 0) {
        sign = 1;
        mantissa *= -1;
    }
    while (mantissa > 10) {
        mantissa /= 10;
        exponent += 1;
    }
    while (mantissa < 1) {
        mantissa *= 10;
        exponent -= 1;
    }
    if (sign === 1) {
        if (exponent >= 0) {
            return join(1, 999 - exponent, 10 - mantissa);
        }
        else {
            return join(2, exponent * -1, 10 - mantissa);
        }
    }
    else {
        if (exponent < 0) {
            return join(4, 999 + exponent, mantissa);
        }
        else {
            return join(5, exponent, mantissa);
        }
    }
};
//# sourceMappingURL=fpstring.js.map

/***/ }),

/***/ "../../dist/esm/serialization/index.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "C1": () => (/* reexport safe */ _patterns_js__WEBPACK_IMPORTED_MODULE_1__.C),
/* harmony export */   "E9": () => (/* reexport safe */ _quads_js__WEBPACK_IMPORTED_MODULE_0__.E),
/* harmony export */   "LT": () => (/* reexport safe */ _quads_js__WEBPACK_IMPORTED_MODULE_0__.L)
/* harmony export */ });
/* harmony import */ var _quads_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/serialization/quads.js");
/* harmony import */ var _patterns_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/serialization/patterns.js");


//# sourceMappingURL=index.js.map

/***/ }),

/***/ "../../dist/esm/serialization/patterns.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "C": () => (/* binding */ writePattern)
/* harmony export */ });
/* harmony import */ var _xsd_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/serialization/xsd.js");
/* harmony import */ var _fpstring_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/serialization/fpstring.js");
/* harmony import */ var _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/utils/constants.js");
/* harmony import */ var _terms_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/serialization/terms.js");




const patternLiteralWriter = {
    write(term) {
        if (term.language) {
            return _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .langStringLiteralWriter.write */ .Q_.write(undefined, 0, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr);
        }
        if (term.datatype) {
            switch (term.datatype.value) {
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .string */ .Z_:
                    return _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .stringLiteralWriter.write */ .Ze.write(undefined, 0, term);
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .double */ .tx:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .nonPositiveInteger */ .ju:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .negativeInteger */ .$M:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .long */ .sw:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .int */ .e$:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .short */ .jv:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .byte */ .HB:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .nonNegativeInteger */ .Rd:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedLong */ .Mt:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedInt */ .GZ:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedShort */ .yn:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedByte */ .Rh:
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .positiveInteger */ .IL:
                    return _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .numericLiteralWriter.write */ .Or.write(undefined, 0, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr, (0,_fpstring_js__WEBPACK_IMPORTED_MODULE_1__/* .encode */ .c)(term.value), true);
                case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .dateTime */ .CQ:
                    return _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .numericLiteralWriter.write */ .Or.write(undefined, 0, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr, (0,_fpstring_js__WEBPACK_IMPORTED_MODULE_1__/* .encode */ .c)(new Date(term.value).valueOf()), true);
                default:
                    return _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .genericLiteralWriter.write */ .c3.write(undefined, 0, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr);
            }
        }
        return _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .stringLiteralWriter.write */ .Ze.write(undefined, 0, term);
    }
};
const writePattern = (pattern, index, prefixes) => {
    let gt = index.prefix;
    let lt = index.prefix;
    let gte = true;
    let lte = true;
    let didRange = false;
    let didLiteral = false;
    let remaining = Object.entries(pattern).filter(([termName, term]) => term).length;
    if (remaining === 0) {
        lt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .boundary */ .M0;
        return { gt, lt, gte, lte, order: index.terms, index };
    }
    let t = 0;
    for (; t < index.terms.length && remaining > 0; t += 1) {
        const term = pattern[index.terms[t]];
        if (!term) {
            return null;
        }
        if (didRange || didLiteral) {
            return null;
        }
        switch (term.termType) {
            case 'Range':
                didRange = true;
                if (term.gt) {
                    gt += patternLiteralWriter.write(term.gt);
                    gte = false;
                }
                else if (term.gte) {
                    gt += patternLiteralWriter.write(term.gte);
                    gte = true;
                }
                if (term.lt) {
                    lt += patternLiteralWriter.write(term.lt);
                    lte = false;
                }
                else if (term.lte) {
                    lt += patternLiteralWriter.write(term.lte);
                    lte = true;
                }
                break;
            case 'Literal':
                didLiteral = true;
                gt += patternLiteralWriter.write(term);
                gte = true;
                lt += patternLiteralWriter.write(term);
                lte = true;
                break;
            case 'NamedNode':
                gt += _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .namedNodeWriter.write */ .Ae.write(undefined, 0, term, prefixes);
                gte = true;
                lt += _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .namedNodeWriter.write */ .Ae.write(undefined, 0, term, prefixes);
                lte = true;
                break;
            case 'BlankNode':
                gt += _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .blankNodeWriter.write */ .lT.write(undefined, 0, term);
                gte = true;
                lt += _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .blankNodeWriter.write */ .lT.write(undefined, 0, term);
                lte = true;
                break;
            case 'DefaultGraph':
                gt += _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .defaultGraphWriter.write */ .Rq.write(undefined, 0, term);
                gte = true;
                lt += _terms_js__WEBPACK_IMPORTED_MODULE_3__/* .defaultGraphWriter.write */ .Rq.write(undefined, 0, term);
                lte = true;
                break;
        }
        remaining -= 1;
        if (remaining > 0 && t < index.terms.length - 1) {
            gt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr;
            lt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr;
        }
    }
    if (lte) {
        if (didRange || didLiteral) {
            lt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .boundary */ .M0;
        }
        else {
            lt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr + _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .boundary */ .M0;
        }
    }
    else {
        lt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr;
    }
    if (gte) {
        if (!didRange && !didLiteral) {
            gt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr;
        }
    }
    else {
        if (didRange || didLiteral) {
            gt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .boundary */ .M0;
        }
        else {
            gt += _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .separator */ .kr + _utils_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .boundary */ .M0;
        }
    }
    return { gt, lt, gte, lte, order: index.terms.slice(didRange ? t - 1 : 1), index };
};
//# sourceMappingURL=patterns.js.map

/***/ }),

/***/ "../../dist/esm/serialization/quads.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "E": () => (/* binding */ quadReader),
/* harmony export */   "L": () => (/* binding */ quadWriter)
/* harmony export */ });
/* harmony import */ var _utils_constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/constants.js");
/* harmony import */ var _terms_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/serialization/terms.js");


const quadWriter = {
    writtenValueLength: 0,
    write(prefix, value, baseValueOffset, quad, termNames, prefixes) {
        let ret = prefix;
        let valueOffset = baseValueOffset;
        for (let t = 0, term; t < termNames.length; t += 1) {
            term = quad[termNames[t]];
            ret += _terms_js__WEBPACK_IMPORTED_MODULE_1__/* .termWriter.write */ .vu.write(value, valueOffset, term, prefixes) + _utils_constants_js__WEBPACK_IMPORTED_MODULE_0__/* .separator */ .kr;
            valueOffset += _terms_js__WEBPACK_IMPORTED_MODULE_1__/* .termWriter.writtenValueLength */ .vu.writtenValueLength;
        }
        this.writtenValueLength = valueOffset - baseValueOffset;
        return ret;
    },
};
const quadReader = {
    subject: null,
    predicate: null,
    object: null,
    graph: null,
    read(key, keyOffset, value, valueOffset, termNames, factory, prefixes) {
        for (let t = 0, termName; t < termNames.length; t += 1) {
            termName = termNames[t];
            this[termName] = _terms_js__WEBPACK_IMPORTED_MODULE_1__/* .termReader.read */ .cS.read(key, keyOffset, value, valueOffset, factory, prefixes);
            keyOffset += _terms_js__WEBPACK_IMPORTED_MODULE_1__/* .termReader.readKeyChars */ .cS.readKeyChars + _utils_constants_js__WEBPACK_IMPORTED_MODULE_0__/* .separator.length */ .kr.length;
            valueOffset += _terms_js__WEBPACK_IMPORTED_MODULE_1__/* .termReader.readValueLength */ .cS.readValueLength;
        }
        return factory.quad(this.subject, this.predicate, this.object, this.graph);
    },
};
//# sourceMappingURL=quads.js.map

/***/ }),

/***/ "../../dist/esm/serialization/terms.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Ae": () => (/* binding */ namedNodeWriter),
/* harmony export */   "Or": () => (/* binding */ numericLiteralWriter),
/* harmony export */   "Q_": () => (/* binding */ langStringLiteralWriter),
/* harmony export */   "Rq": () => (/* binding */ defaultGraphWriter),
/* harmony export */   "Ze": () => (/* binding */ stringLiteralWriter),
/* harmony export */   "c3": () => (/* binding */ genericLiteralWriter),
/* harmony export */   "cS": () => (/* binding */ termReader),
/* harmony export */   "lT": () => (/* binding */ blankNodeWriter),
/* harmony export */   "vu": () => (/* binding */ termWriter)
/* harmony export */ });
/* unused harmony exports namedNodeReader, blankNodeReader, genericLiteralReader, stringLiteralReader, langStringLiteralReader, numericLiteralReader, defaultGraphReader */
/* harmony import */ var _xsd_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/serialization/xsd.js");
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/serialization/utils.js");
/* harmony import */ var _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/utils/constants.js");
/* harmony import */ var _fpstring_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/serialization/fpstring.js");




const namedNodeWriter = {
    writtenValueLength: 1,
    write(value, valueOffset, node, prefixes) {
        const compactedIri = prefixes.compactIri(node.value);
        if (value) {
            value[valueOffset] = compactedIri.length;
        }
        return compactedIri;
    },
};
const namedNodeReader = {
    readValueLength: 1,
    readKeyChars: 0,
    read(key, keyOffset, value, valueOffset, factory, prefixes) {
        const valueLen = value[valueOffset];
        this.readKeyChars = valueLen;
        return factory.namedNode(prefixes.expandTerm((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset, valueLen)));
    },
};
const blankNodeWriter = {
    writtenValueLength: 1,
    write(value, valueOffset, node) {
        if (value) {
            value[valueOffset] = node.value.length;
        }
        return node.value;
    },
};
const blankNodeReader = {
    readValueLength: 1,
    readKeyChars: 0,
    read(key, keyOffset, value, valueOffset, factory) {
        const valueLen = value[valueOffset];
        this.readKeyChars = valueLen;
        return factory.blankNode((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset, valueLen));
    },
};
const genericLiteralWriter = {
    writtenValueLength: 2,
    write(value, valueOffset, node, separator) {
        if (value) {
            value[valueOffset] = node.value.length;
            value[valueOffset + 1] = node.datatype.value.length;
        }
        return node.datatype.value + separator + node.value;
    },
};
const genericLiteralReader = {
    readValueLength: 2,
    readKeyChars: 0,
    read(key, keyOffset, value, valueOffset, factory, separator) {
        const valueLen = value[valueOffset];
        const datatypeValueLen = value[valueOffset + 1];
        this.readKeyChars = valueLen + datatypeValueLen + separator.length;
        return factory.literal((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset + datatypeValueLen + separator.length, valueLen), factory.namedNode((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset, datatypeValueLen)));
    },
};
const stringLiteralWriter = {
    writtenValueLength: 1,
    write(value, valueOffset, node) {
        if (value) {
            value[valueOffset] = node.value.length;
        }
        return node.value;
    },
};
const stringLiteralReader = {
    readValueLength: 1,
    readKeyChars: 0,
    read(key, keyOffset, value, valueOffset, factory) {
        const valueLen = value[valueOffset];
        this.readKeyChars = valueLen;
        return factory.literal((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset, valueLen));
    },
};
const langStringLiteralWriter = {
    writtenValueLength: 2,
    write(value, valueOffset, node, separator) {
        if (value) {
            value[valueOffset] = node.value.length;
            value[valueOffset + 1] = node.language.length;
        }
        return node.language + separator + node.value;
    },
};
const langStringLiteralReader = {
    readValueLength: 2,
    readKeyChars: 0,
    read(key, keyOffset, value, valueOffset, factory, separator) {
        const valueLen = value[valueOffset];
        const langCodeLen = value[valueOffset + 1];
        this.readKeyChars = valueLen + langCodeLen + separator.length;
        return factory.literal((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset + langCodeLen + separator.length, valueLen), (0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset, langCodeLen));
    },
};
const numericLiteralWriter = {
    writtenValueLength: 3,
    write(value, valueOffset, node, separator, encodedNumericValue, rangeMode) {
        if (value) {
            value[valueOffset] = node.value.length;
            value[valueOffset + 1] = node.datatype.value.length;
            value[valueOffset + 2] = encodedNumericValue.length;
        }
        let ret = encodedNumericValue;
        if (!rangeMode) {
            ret += separator + node.datatype.value + separator + node.value;
        }
        return ret;
    },
};
const numericLiteralReader = {
    readValueLength: 3,
    readKeyChars: 0,
    read(key, keyOffset, value, valueOffset, factory, separator) {
        const valueLen = value[valueOffset];
        const datatypeValueLen = value[valueOffset + 1];
        const numericValueLen = value[valueOffset + 2];
        this.readKeyChars = numericValueLen + datatypeValueLen + valueLen + (separator.length * 2);
        return factory.literal((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset + numericValueLen + separator.length + datatypeValueLen + separator.length, valueLen), factory.namedNode((0,_utils_js__WEBPACK_IMPORTED_MODULE_3__/* .sliceString */ .pY)(key, keyOffset + numericValueLen + separator.length, datatypeValueLen)));
    },
};
const defaultGraphWriter = {
    writtenValueLength: 1,
    write(value, valueOffset, node) {
        if (value) {
            value[valueOffset] = 2;
        }
        return 'dg';
    },
};
const defaultGraphReader = {
    readValueLength: 1,
    readKeyChars: 2,
    read(key, keyOffset, value, valueOffset, factory) {
        return factory.defaultGraph();
    },
};
const termWriter = {
    writtenValueLength: 0,
    write(value, baseValueOffset, term, prefixes) {
        let ret = '';
        let valueOffset = baseValueOffset;
        switch (term.termType) {
            case 'NamedNode':
                if (value) {
                    value[valueOffset] = 0;
                }
                valueOffset += 1;
                ret += namedNodeWriter.write(value, valueOffset, term, prefixes);
                valueOffset += namedNodeWriter.writtenValueLength;
                break;
            case 'BlankNode':
                if (value) {
                    value[valueOffset] = 1;
                }
                valueOffset += 1;
                ret += blankNodeWriter.write(value, valueOffset, term);
                valueOffset += blankNodeWriter.writtenValueLength;
                break;
            case 'DefaultGraph':
                if (value) {
                    value[valueOffset] = 6;
                }
                valueOffset += 1;
                ret += defaultGraphWriter.write(value, valueOffset, term);
                valueOffset += defaultGraphWriter.writtenValueLength;
                break;
            case 'Literal':
                if (term.language) {
                    if (value) {
                        value[valueOffset] = 4;
                    }
                    valueOffset += 1;
                    ret += langStringLiteralWriter.write(value, valueOffset, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr);
                    valueOffset += langStringLiteralWriter.writtenValueLength;
                }
                else if (term.datatype) {
                    switch (term.datatype.value) {
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .string */ .Z_:
                            if (value) {
                                value[valueOffset] = 3;
                            }
                            valueOffset += 1;
                            ret += stringLiteralWriter.write(value, valueOffset, term);
                            valueOffset += stringLiteralWriter.writtenValueLength;
                            break;
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .double */ .tx:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .nonPositiveInteger */ .ju:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .negativeInteger */ .$M:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .long */ .sw:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .int */ .e$:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .short */ .jv:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .byte */ .HB:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .nonNegativeInteger */ .Rd:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedLong */ .Mt:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedInt */ .GZ:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedShort */ .yn:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .unsignedByte */ .Rh:
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .positiveInteger */ .IL:
                            if (value) {
                                value[valueOffset] = 5;
                            }
                            valueOffset += 1;
                            ret += numericLiteralWriter.write(value, valueOffset, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr, (0,_fpstring_js__WEBPACK_IMPORTED_MODULE_2__/* .encode */ .c)(term.value), false);
                            valueOffset += numericLiteralWriter.writtenValueLength;
                            break;
                        case _xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .dateTime */ .CQ:
                            if (value) {
                                value[valueOffset] = 5;
                            }
                            valueOffset += 1;
                            ret += numericLiteralWriter.write(value, valueOffset, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr, (0,_fpstring_js__WEBPACK_IMPORTED_MODULE_2__/* .encode */ .c)(new Date(term.value).valueOf()), false);
                            valueOffset += numericLiteralWriter.writtenValueLength;
                            break;
                        default:
                            if (value) {
                                value[valueOffset] = 2;
                            }
                            valueOffset += 1;
                            ret += genericLiteralWriter.write(value, valueOffset, term, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr);
                            valueOffset += genericLiteralWriter.writtenValueLength;
                    }
                }
                else {
                    if (value) {
                        value[valueOffset] = 3;
                    }
                    valueOffset += 1;
                    ret += stringLiteralWriter.write(value, valueOffset, term);
                    valueOffset += stringLiteralWriter.writtenValueLength;
                }
        }
        this.writtenValueLength = valueOffset - baseValueOffset;
        return ret;
    }
};
const termReader = {
    readKeyChars: 0,
    readValueLength: 0,
    read(key, baseKeyOffset, value, baseValueOffset, factory, prefixes) {
        let keyOffset = baseKeyOffset;
        let valueOffset = baseValueOffset;
        let termValue;
        const encodedTermType = value[valueOffset];
        valueOffset += 1;
        switch (encodedTermType) {
            case 0:
                termValue = namedNodeReader.read(key, keyOffset, value, valueOffset, factory, prefixes);
                keyOffset += namedNodeReader.readKeyChars;
                valueOffset += namedNodeReader.readValueLength;
                break;
            case 1:
                termValue = blankNodeReader.read(key, keyOffset, value, valueOffset, factory);
                keyOffset += blankNodeReader.readKeyChars;
                valueOffset += blankNodeReader.readValueLength;
                break;
            case 2:
                termValue = genericLiteralReader.read(key, keyOffset, value, valueOffset, factory, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr);
                keyOffset += genericLiteralReader.readKeyChars;
                valueOffset += genericLiteralReader.readValueLength;
                break;
            case 3:
                termValue = stringLiteralReader.read(key, keyOffset, value, valueOffset, factory);
                keyOffset += stringLiteralReader.readKeyChars;
                valueOffset += stringLiteralReader.readValueLength;
                break;
            case 4:
                termValue = langStringLiteralReader.read(key, keyOffset, value, valueOffset, factory, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr);
                keyOffset += langStringLiteralReader.readKeyChars;
                valueOffset += langStringLiteralReader.readValueLength;
                break;
            case 5:
                termValue = numericLiteralReader.read(key, keyOffset, value, valueOffset, factory, _utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .separator */ .kr);
                keyOffset += numericLiteralReader.readKeyChars;
                valueOffset += numericLiteralReader.readValueLength;
                break;
            case 6:
                termValue = defaultGraphReader.read(key, keyOffset, value, valueOffset, factory);
                keyOffset += defaultGraphReader.readKeyChars;
                valueOffset += defaultGraphReader.readValueLength;
                break;
            default: throw new Error(`Unexpected encoded term type "${encodedTermType}"`);
        }
        this.readKeyChars = keyOffset - baseKeyOffset;
        this.readValueLength = valueOffset - baseValueOffset;
        return termValue;
    }
};
//# sourceMappingURL=terms.js.map

/***/ }),

/***/ "../../dist/esm/serialization/utils.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ch": () => (/* binding */ viewUint8ArrayAsUint16Array),
/* harmony export */   "pY": () => (/* binding */ sliceString),
/* harmony export */   "wU": () => (/* binding */ viewUint16ArrayAsUint8Array)
/* harmony export */ });
const sliceString = (source, offset, length) => {
    return source.slice(offset, offset + length);
};
const viewUint8ArrayAsUint16Array = (source) => {
    return new Uint16Array(source.buffer, source.byteOffset, source.byteLength / 2);
};
const viewUint16ArrayAsUint8Array = (source, offset, length) => {
    return new Uint8Array(source.buffer, source.byteOffset + offset * 2, length * 2);
};
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ "../../dist/esm/serialization/xsd.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "$M": () => (/* binding */ negativeInteger),
/* harmony export */   "CQ": () => (/* binding */ dateTime),
/* harmony export */   "GZ": () => (/* binding */ unsignedInt),
/* harmony export */   "HB": () => (/* binding */ byte),
/* harmony export */   "IL": () => (/* binding */ positiveInteger),
/* harmony export */   "Mt": () => (/* binding */ unsignedLong),
/* harmony export */   "Rd": () => (/* binding */ nonNegativeInteger),
/* harmony export */   "Rh": () => (/* binding */ unsignedByte),
/* harmony export */   "Z_": () => (/* binding */ string),
/* harmony export */   "_L": () => (/* binding */ integer),
/* harmony export */   "e$": () => (/* binding */ int),
/* harmony export */   "gH": () => (/* binding */ decimal),
/* harmony export */   "ju": () => (/* binding */ nonPositiveInteger),
/* harmony export */   "jv": () => (/* binding */ short),
/* harmony export */   "sw": () => (/* binding */ long),
/* harmony export */   "tx": () => (/* binding */ double),
/* harmony export */   "yn": () => (/* binding */ unsignedShort)
/* harmony export */ });
/* unused harmony exports xsd, rdf, langString, boolean */
const xsd = 'http://www.w3.org/2001/XMLSchema#';
const rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const langString = `${rdf}langString`;
const string = `${xsd}string`;
const dateTime = `${xsd}dateTime`;
const boolean = `${xsd}boolean`;
const integer = `${xsd}integer`;
const decimal = `${xsd}decimal`;
const double = `${xsd}double`;
const nonPositiveInteger = `${xsd}nonPositiveInteger`;
const negativeInteger = `${xsd}negativeInteger`;
const long = `${xsd}long`;
const int = `${xsd}int`;
const short = `${xsd}short`;
const byte = `${xsd}byte`;
const nonNegativeInteger = `${xsd}nonNegativeInteger`;
const unsignedLong = `${xsd}unsignedLong`;
const unsignedInt = `${xsd}unsignedInt`;
const unsignedShort = `${xsd}unsignedShort`;
const unsignedByte = `${xsd}unsignedByte`;
const positiveInteger = `${xsd}positiveInteger`;
//# sourceMappingURL=xsd.js.map

/***/ }),

/***/ "../../dist/esm/types/index.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "X": () => (/* binding */ ResultType)
/* harmony export */ });
var ResultType;
(function (ResultType) {
    ResultType["VOID"] = "void";
    ResultType["QUADS"] = "quads";
    ResultType["APPROXIMATE_SIZE"] = "approximate_size";
})(ResultType || (ResultType = {}));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "../../dist/esm/utils/constants.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FD": () => (/* binding */ emptyObject),
/* harmony export */   "Is": () => (/* binding */ levelPutOpts),
/* harmony export */   "M0": () => (/* binding */ boundary),
/* harmony export */   "Od": () => (/* binding */ termNames),
/* harmony export */   "P6": () => (/* binding */ levelDelOpts),
/* harmony export */   "kr": () => (/* binding */ separator),
/* harmony export */   "yw": () => (/* binding */ defaultIndexes)
/* harmony export */ });
const emptyObject = {};
const boundary = '\uDBFF\uDFFF';
const separator = '\u0000\u0000';
const termNames = [
    'subject',
    'predicate',
    'object',
    'graph',
];
const defaultIndexes = [
    ['subject', 'predicate', 'object', 'graph'],
    ['object', 'graph', 'subject', 'predicate'],
    ['graph', 'subject', 'predicate', 'object'],
    ['subject', 'object', 'predicate', 'graph'],
    ['predicate', 'object', 'graph', 'subject'],
    ['graph', 'predicate', 'object', 'subject'],
];
const levelPutOpts = {
    keyEncoding: 'utf8',
    valueEncoding: 'view',
};
const levelDelOpts = {
    keyEncoding: 'utf8',
};
//# sourceMappingURL=constants.js.map

/***/ }),

/***/ "../../dist/esm/utils/consumeinbatches.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "f": () => (/* binding */ consumeInBatches)
/* harmony export */ });
const consumeInBatches = async (readable, batchSize, onEachBatch) => {
    return new Promise((resolve, reject) => {
        let bufpos = 0;
        let looping = false;
        let ended = false;
        let buffer = new Array(batchSize);
        const flushAndResolve = () => {
            cleanup();
            if (bufpos > 0) {
                Promise.resolve(onEachBatch(buffer.slice(0, bufpos)))
                    .then(resolve)
                    .catch(onError);
                return;
            }
            resolve();
        };
        const onEnd = () => {
            ended = true;
            if (!looping) {
                flushAndResolve();
            }
        };
        const onError = (err) => {
            cleanup();
            reject(err);
        };
        const onReadable = () => {
            if (!looping) {
                loop();
            }
        };
        let item = null;
        const loop = () => {
            looping = true;
            if (ended) {
                flushAndResolve();
                return;
            }
            while (bufpos < batchSize && (item = readable.read()) !== null) {
                buffer[bufpos++] = item;
            }
            if (item === null) {
                looping = false;
                return;
            }
            if (bufpos === batchSize) {
                Promise.resolve(onEachBatch(buffer.slice()))
                    .then(loop)
                    .catch(onError);
                bufpos = 0;
            }
        };
        const cleanup = () => {
            readable.removeListener('end', onEnd);
            readable.removeListener('error', onError);
            readable.removeListener('readable', onReadable);
            if (typeof readable.destroy === 'function') {
                readable.destroy();
            }
        };
        readable.on('end', onEnd);
        readable.on('error', onError);
        readable.on('readable', onReadable);
        if (readable.readable !== false) {
            loop();
        }
    });
};
//# sourceMappingURL=consumeinbatches.js.map

/***/ }),

/***/ "../../dist/esm/utils/consumeonebyone.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "_": () => (/* binding */ consumeOneByOne)
/* harmony export */ });
const consumeOneByOne = async (iterator, onEachItem) => {
    return new Promise((resolve, reject) => {
        let item;
        let ended = false;
        let looping = false;
        const loop = () => {
            looping = true;
            if ((item = iterator.read()) !== null) {
                Promise.resolve(onEachItem(item))
                    .then(loop)
                    .catch(onError);
                return;
            }
            looping = false;
            if (ended) {
                resolve();
            }
        };
        const onError = (err) => {
            reject(err);
            cleanup();
        };
        const onEnd = () => {
            ended = true;
            if (!looping) {
                resolve();
            }
            cleanup();
        };
        const onReadable = () => {
            if (!looping) {
                loop();
            }
        };
        const cleanup = () => {
            iterator.removeListener('end', onEnd);
            iterator.removeListener('error', onError);
            iterator.removeListener('readable', onReadable);
            if (typeof iterator.destroy === 'function') {
                iterator.destroy();
            }
        };
        iterator.on('end', onEnd);
        iterator.on('error', onError);
        iterator.on('readable', onReadable);
        if (iterator.readable !== false) {
            loop();
        }
    });
};
//# sourceMappingURL=consumeonebyone.js.map

/***/ }),

/***/ "../../dist/esm/utils/stuff.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Jp": () => (/* binding */ arrStartsWith),
/* harmony export */   "XL": () => (/* binding */ RESOLVED),
/* harmony export */   "an": () => (/* binding */ streamToArray),
/* harmony export */   "gG": () => (/* binding */ ensureAbstractLevel),
/* harmony export */   "mA": () => (/* binding */ waitForEvent)
/* harmony export */ });
/* unused harmony exports isObject, isAbstractLevel, resolveOnEvent */
const isObject = (o) => {
    return typeof (o) === 'object' && o !== null;
};
const isAbstractLevel = (o) => {
    return isObject(o)
        && typeof (o.open) === 'function'
        && typeof (o.batch) === 'function';
};
const ensureAbstractLevel = (o, key) => {
    if (!isAbstractLevel(o)) {
        throw new Error(`${key} is not an AbstractLevel instance`);
    }
};
const streamToArray = (readStream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const onData = (chunk) => {
            chunks.push(chunk);
        };
        const cleanup = () => {
            readStream.removeListener('data', onData);
            readStream.removeListener('error', onError);
            readStream.destroy();
        };
        const onEnd = () => {
            cleanup();
            resolve(chunks);
        };
        const onError = (err) => {
            cleanup();
            reject(err);
        };
        readStream.on('error', onError);
        readStream.on('end', onEnd);
        readStream.on('data', onData);
    });
};
const resolveOnEvent = (emitter, event, rejectOnError) => {
    return new Promise((resolve, reject) => {
        const onceEvent = (arg) => {
            emitter.removeListener('error', onceError);
            resolve(arg);
        };
        const onceError = (err) => {
            emitter.removeListener(event, onceEvent);
            reject(err);
        };
        emitter.once(event, onceEvent);
        if (rejectOnError) {
            emitter.once('error', onceError);
        }
    });
};
const waitForEvent = resolveOnEvent;
const arrStartsWith = (arr, prefix) => {
    for (let i = 0; i < prefix.length; i += 1) {
        if (prefix[i] !== arr[i]) {
            return false;
        }
    }
    return true;
};
const RESOLVED = Promise.resolve();
//# sourceMappingURL=stuff.js.map

/***/ }),

/***/ "../../dist/esm/utils/uid.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "h": () => (/* binding */ uid)
/* harmony export */ });
/* unused harmony export createUid */
let IDX = 256;
const HEX = [];
while (IDX--) {
    HEX[IDX] = (IDX + 256).toString(16).substring(1);
}
const createUid = (len) => {
    len = len || 16;
    let str = '';
    let num = 0;
    return () => {
        if (!str || num === 256) {
            str = '';
            num = (1 + len) / 2 | 0;
            while (num--) {
                str += HEX[256 * Math.random() | 0];
            }
            str = str.substring(num = 0, len - 2);
        }
        return str + HEX[num++];
    };
};
const uid = createUid(11);
//# sourceMappingURL=uid.js.map

/***/ }),

/***/ "../../node_modules/asynciterator/dist/asynciterator.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "K0": () => (/* binding */ EmptyIterator),
/* harmony export */   "Tp": () => (/* binding */ BufferedIterator),
/* harmony export */   "m": () => (/* binding */ ArrayIterator),
/* harmony export */   "rG": () => (/* binding */ AsyncIterator),
/* harmony export */   "re": () => (/* binding */ wrap),
/* harmony export */   "ye": () => (/* binding */ IntegerIterator)
/* harmony export */ });
/* unused harmony exports scheduleTask, getTaskScheduler, setTaskScheduler, INIT, OPEN, CLOSING, CLOSED, ENDED, DESTROYED, SingletonIterator, identity, DESTINATION, MappingIterator, TransformIterator, SimpleTransformIterator, MultiTransformIterator, UnionIterator, ClonedIterator, WrappingIterator, empty, single, fromArray, fromIterator, fromIterable, union, range, isFunction, isEventEmitter, isPromise, isSourceExpression, isIterable, isIterator */
/* harmony import */ var events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/events/events.js");
/* harmony import */ var _linkedlist_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../node_modules/asynciterator/dist/linkedlist.js");
/* harmony import */ var _taskscheduler_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/asynciterator/dist/taskscheduler.js");
/**
 * An asynchronous iterator library for advanced object pipelines
 * @module asynciterator
 */



let taskScheduler = (0,_taskscheduler_js__WEBPACK_IMPORTED_MODULE_1__/* .createTaskScheduler */ .r)();
// Export utilities for reuse

/** Schedules the given task for asynchronous execution. */
function scheduleTask(task) {
    taskScheduler(task);
}
/** Returns the asynchronous task scheduler. */
function getTaskScheduler() {
    return taskScheduler;
}
/** Sets the asynchronous task scheduler. */
function setTaskScheduler(scheduler) {
    taskScheduler = scheduler;
}
/**
  ID of the INIT state.
  An iterator is initializing if it is preparing main item generation.
  It can already produce items.
  @type integer
*/
const INIT = 1 << 0;
/**
  ID of the OPEN state.
  An iterator is open if it can generate new items.
  @type integer
*/
const OPEN = 1 << 1;
/**
  ID of the CLOSING state.
  An iterator is closing if item generation is pending but will not be scheduled again.
  @type integer
*/
const CLOSING = 1 << 2;
/**
  ID of the CLOSED state.
  An iterator is closed if it no longer actively generates new items.
  Items might still be available.
  @type integer
*/
const CLOSED = 1 << 3;
/**
  ID of the ENDED state.
  An iterator has ended if no further items will become available.
  The 'end' event is guaranteed to have been called when in this state.
  @type integer
*/
const ENDED = 1 << 4;
/**
  ID of the DESTROYED state.
  An iterator has been destroyed
  after calling {@link module:asynciterator.AsyncIterator#destroy}.
  The 'end' event has not been called, as pending elements were voided.
  @type integer
*/
const DESTROYED = 1 << 5;
/**
  An asynchronous iterator provides pull-based access to a stream of objects.
  @extends module:asynciterator.EventEmitter
*/
class AsyncIterator extends events__WEBPACK_IMPORTED_MODULE_0__.EventEmitter {
    /** Creates a new `AsyncIterator`. */
    constructor(initialState = OPEN) {
        super();
        this._readable = false;
        this._state = initialState;
        this.on('newListener', waitForDataListener);
    }
    /**
      Changes the iterator to the given state if possible and necessary,
      possibly emitting events to signal that change.
      @protected
      @param {integer} newState The ID of the new state
      @param {boolean} [eventAsync=false] Whether resulting events should be emitted asynchronously
      @returns {boolean} Whether the state was changed
      @emits module:asynciterator.AsyncIterator.end
    */
    _changeState(newState, eventAsync = false) {
        // Validate the state change
        const valid = newState > this._state && this._state < ENDED;
        if (valid) {
            this._state = newState;
            // Emit the `end` event when changing to ENDED
            if (newState === ENDED) {
                if (!eventAsync)
                    this.emit('end');
                else
                    taskScheduler(() => this.emit('end'));
            }
        }
        return valid;
    }
    /**
      Tries to read the next item from the iterator.
      This is the main method for reading the iterator in _on-demand mode_,
      where new items are only created when needed by consumers.
      If no items are currently available, this methods returns `null`.
      The {@link module:asynciterator.event:readable} event
      will then signal when new items might be ready.
      To read all items from the iterator,
      switch to _flow mode_ by subscribing
      to the {@link module:asynciterator.event:data} event.
      When in flow mode, do not use the `read` method.
      @returns {object?} The next item, or `null` if none is available
    */
    read() {
        return null;
    }
    /**
      The iterator emits a `readable` event when it might have new items available
      after having had no items available right before this event.
      If the iterator is not in flow mode, items can be retrieved
      by calling {@link module:asynciterator.AsyncIterator#read}.
      @event module:asynciterator.readable
    */
    /**
      The iterator emits a `data` event with a new item as soon as it becomes available.
      When one or more listeners are attached to the `data` event,
      the iterator switches to _flow mode_,
      generating and emitting new items as fast as possible.
      This drains the source and might create backpressure on the consumers,
      so only subscribe to this event if this behavior is intended.
      In flow mode, don't use {@link module:asynciterator.AsyncIterator#read}.
      To switch back to _on-demand mode_, remove all listeners from the `data` event.
      You can then obtain items through `read` again.
      @event module:asynciterator.data
      @param {object} item The new item
    */
    /**
      Invokes the callback for each remaining item in the iterator.
      Switches the iterator to flow mode.
      @param {Function} callback A function that will be called with each item
      @param {object?} self The `this` pointer for the callback
    */
    forEach(callback, self) {
        this.on('data', bind(callback, self));
    }
    /**
      Stops the iterator from generating new items.
      Already generated items or terminating items can still be emitted.
      After this, the iterator will end asynchronously.
      @emits module:asynciterator.AsyncIterator.end
    */
    close() {
        if (this._changeState(CLOSED))
            this._endAsync();
    }
    /**
      Destroy the iterator and stop it from generating new items.
      This will not do anything if the iterator was already ended or destroyed.
      All internal resources will be released an no new items will be emitted,
      even not already generated items.
      Implementors should not override this method,
      but instead implement {@link module:asynciterator.AsyncIterator#_destroy}.
      @param {Error} [cause] An optional error to emit.
      @emits module:asynciterator.AsyncIterator.end
      @emits module:asynciterator.AsyncIterator.error Only if an error is passed.
    */
    destroy(cause) {
        if (!this.done) {
            this._destroy(cause, error => {
                cause = cause || error;
                if (cause)
                    this.emit('error', cause);
                this._end(true);
            });
        }
    }
    /**
      Called by {@link module:asynciterator.AsyncIterator#destroy}.
      Implementers can override this, but this should not be called directly.
      @param {?Error} cause The reason why the iterator is destroyed.
      @param {Function} callback A callback function with an optional error argument.
    */
    _destroy(cause, callback) {
        callback();
    }
    /**
      Ends the iterator and cleans up.
      Should never be called before {@link module:asynciterator.AsyncIterator#close};
      typically, `close` is responsible for calling `_end`.
      @param {boolean} [destroy] If the iterator should be forcefully destroyed.
      @protected
      @emits module:asynciterator.AsyncIterator.end
    */
    _end(destroy = false) {
        if (this._changeState(destroy ? DESTROYED : ENDED)) {
            this._readable = false;
            this.removeAllListeners('readable');
            this.removeAllListeners('data');
            this.removeAllListeners('end');
        }
    }
    /**
      Asynchronously calls `_end`.
      @protected
    */
    _endAsync() {
        taskScheduler(() => this._end());
    }
    /**
      The `end` event is emitted after the last item of the iterator has been read.
      @event module:asynciterator.end
    */
    /**
      Gets or sets whether this iterator might have items available for read.
      A value of `false` means there are _definitely_ no items available;
      a value of `true` means items _might_ be available.
      @type boolean
      @emits module:asynciterator.AsyncIterator.readable
    */
    get readable() {
        return this._readable;
    }
    set readable(readable) {
        readable = Boolean(readable) && !this.done;
        // Set the readable value only if it has changed
        if (this._readable !== readable) {
            this._readable = readable;
            // If the iterator became readable, emit the `readable` event
            if (readable)
                taskScheduler(() => this.emit('readable'));
        }
    }
    /**
      Gets whether the iterator has stopped generating new items.
      @type boolean
      @readonly
    */
    get closed() {
        return this._state >= CLOSING;
    }
    /**
      Gets whether the iterator has finished emitting items.
      @type boolean
      @readonly
    */
    get ended() {
        return this._state === ENDED;
    }
    /**
      Gets whether the iterator has been destroyed.
      @type boolean
      @readonly
    */
    get destroyed() {
        return this._state === DESTROYED;
    }
    /**
      Gets whether the iterator will not emit anymore items,
      either due to being closed or due to being destroyed.
      @type boolean
      @readonly
    */
    get done() {
        return this._state >= ENDED;
    }
    /* Generates a textual representation of the iterator. */
    toString() {
        const details = this._toStringDetails();
        return `[${this.constructor.name}${details ? ` ${details}` : ''}]`;
    }
    /**
      Generates details for a textual representation of the iterator.
      @protected
    */
    _toStringDetails() {
        return '';
    }
    /**
      Consume all remaining items of the iterator into an array that will be returned asynchronously.
      @param {object} [options] Settings for array creation
      @param {integer} [options.limit] The maximum number of items to place in the array.
     */
    toArray(options) {
        const items = [];
        const limit = typeof (options === null || options === void 0 ? void 0 : options.limit) === 'number' ? options.limit : Infinity;
        return this.ended || limit <= 0 ? Promise.resolve(items) : new Promise((resolve, reject) => {
            // Collect and return all items up to the limit
            const resolveItems = () => resolve(items);
            const pushItem = (item) => {
                items.push(item);
                if (items.length >= limit) {
                    this.removeListener('error', reject);
                    this.removeListener('data', pushItem);
                    this.removeListener('end', resolveItems);
                    resolve(items);
                }
            };
            // Start item collection
            this.on('error', reject);
            this.on('data', pushItem);
            this.on('end', resolveItems);
        });
    }
    /**
      Retrieves the property with the given name from the iterator.
      If no callback is passed, it returns the value of the property
      or `undefined` if the property is not set.
      If a callback is passed, it returns `undefined`
      and calls the callback with the property the moment it is set.
      @param {string} propertyName The name of the property to retrieve
      @param {Function?} [callback] A one-argument callback to receive the property value
      @returns {object?} The value of the property (if set and no callback is given)
    */
    getProperty(propertyName, callback) {
        const properties = this._properties;
        // If no callback was passed, return the property value
        if (!callback)
            return properties && properties[propertyName];
        // If the value has been set, send it through the callback
        if (properties && (propertyName in properties)) {
            taskScheduler(() => callback(properties[propertyName]));
        }
        // If the value was not set, store the callback for when the value will be set
        else {
            let propertyCallbacks;
            if (!(propertyCallbacks = this._propertyCallbacks))
                this._propertyCallbacks = propertyCallbacks = Object.create(null);
            if (propertyName in propertyCallbacks)
                propertyCallbacks[propertyName].push(callback);
            else
                propertyCallbacks[propertyName] = [callback];
        }
        return undefined;
    }
    /**
      Sets the property with the given name to the value.
      @param {string} propertyName The name of the property to set
      @param {object?} value The new value of the property
    */
    setProperty(propertyName, value) {
        const properties = this._properties || (this._properties = Object.create(null));
        properties[propertyName] = value;
        // Execute getter callbacks that were waiting for this property to be set
        const propertyCallbacks = this._propertyCallbacks || {};
        const callbacks = propertyCallbacks[propertyName];
        if (callbacks) {
            delete propertyCallbacks[propertyName];
            taskScheduler(() => {
                for (const callback of callbacks)
                    callback(value);
            });
            // Remove _propertyCallbacks if no pending callbacks are left
            for (propertyName in propertyCallbacks)
                return;
            delete this._propertyCallbacks;
        }
    }
    /**
      Retrieves all properties of the iterator.
      @returns {object} An object with property names as keys.
    */
    getProperties() {
        const properties = this._properties;
        const copy = {};
        for (const name in properties)
            copy[name] = properties[name];
        return copy;
    }
    /**
      Sets all of the given properties.
      @param {object} properties Key/value pairs of properties to set
    */
    setProperties(properties) {
        for (const propertyName in properties)
            this.setProperty(propertyName, properties[propertyName]);
    }
    /**
      Copies the given properties from the source iterator.
      @param {module:asynciterator.AsyncIterator} source The iterator to copy from
      @param {Array} propertyNames List of property names to copy
    */
    copyProperties(source, propertyNames) {
        for (const propertyName of propertyNames) {
            source.getProperty(propertyName, value => this.setProperty(propertyName, value));
        }
    }
    /**
      Transforms items from this iterator.
      After this operation, only read the returned iterator instead of the current one.
      @param {object|Function} [options] Settings of the iterator, or the transformation function
      @param {integer} [options.maxbufferSize=4] The maximum number of items to keep in the buffer
      @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
      @param {integer} [options.offset] The number of items to skip
      @param {integer} [options.limit] The maximum number of items
      @param {Function} [options.filter] A function to synchronously filter items from the source
      @param {Function} [options.map] A function to synchronously transform items from the source
      @param {Function} [options.transform] A function to asynchronously transform items from the source
      @param {boolean} [options.optional=false] If transforming is optional, the original item is pushed when its mapping yields `null` or its transformation yields no items
      @param {Array|module:asynciterator.AsyncIterator} [options.prepend] Items to insert before the source items
      @param {Array|module:asynciterator.AsyncIterator} [options.append]  Items to insert after the source items
      @returns {module:asynciterator.AsyncIterator} A new iterator that maps the items from this iterator
    */
    transform(options) {
        return new SimpleTransformIterator(this, options);
    }
    /**
      Maps items from this iterator using the given function.
      After this operation, only read the returned iterator instead of the current one.
      @param {Function} map A mapping function to call on this iterator's (remaining) items
      @param {object?} self The `this` pointer for the mapping function
      @returns {module:asynciterator.AsyncIterator} A new iterator that maps the items from this iterator
    */
    map(map, self) {
        return new MappingIterator(this, bind(map, self));
    }
    filter(filter, self) {
        return this.map(function (item) {
            return filter.call(self || this, item) ? item : null;
        });
    }
    /**
     * Returns a new iterator containing all of the unique items in the original iterator.
     * @param by - The derived value by which to determine uniqueness (e.g., stringification).
                   Defaults to the identity function.
     * @returns An iterator with duplicates filtered out.
     */
    uniq(by = identity) {
        const uniques = new Set();
        return this.filter(function (item) {
            const hashed = by.call(this, item);
            if (!uniques.has(hashed)) {
                uniques.add(hashed);
                return true;
            }
            return false;
        });
    }
    /**
      Prepends the items after those of the current iterator.
      After this operation, only read the returned iterator instead of the current one.
      @param {Array|module:asynciterator.AsyncIterator} items Items to insert before this iterator's (remaining) items
      @returns {module:asynciterator.AsyncIterator} A new iterator that prepends items to this iterator
    */
    prepend(items) {
        return this.transform({ prepend: items });
    }
    /**
      Appends the items after those of the current iterator.
      After this operation, only read the returned iterator instead of the current one.
      @param {Array|module:asynciterator.AsyncIterator} items Items to insert after this iterator's (remaining) items
      @returns {module:asynciterator.AsyncIterator} A new iterator that appends items to this iterator
    */
    append(items) {
        return this.transform({ append: items });
    }
    /**
      Surrounds items of the current iterator with the given items.
      After this operation, only read the returned iterator instead of the current one.
      @param {Array|module:asynciterator.AsyncIterator} prepend Items to insert before this iterator's (remaining) items
      @param {Array|module:asynciterator.AsyncIterator} append Items to insert after this iterator's (remaining) items
      @returns {module:asynciterator.AsyncIterator} A new iterator that appends and prepends items to this iterator
    */
    surround(prepend, append) {
        return this.transform({ prepend, append });
    }
    /**
      Skips the given number of items from the current iterator.
      The current iterator may not be read anymore until the returned iterator ends.
      @param {integer} offset The number of items to skip
      @returns {module:asynciterator.AsyncIterator} A new iterator that skips the given number of items
    */
    skip(offset) {
        return this.map(item => offset-- > 0 ? null : item);
    }
    /**
      Limits the current iterator to the given number of items.
      The current iterator may not be read anymore until the returned iterator ends.
      @param {integer} limit The maximum number of items
      @returns {module:asynciterator.AsyncIterator} A new iterator with at most the given number of items
    */
    take(limit) {
        return this.transform({ limit });
    }
    /**
      Limits the current iterator to the given range.
      The current iterator may not be read anymore until the returned iterator ends.
      @param {integer} start Index of the first item to return
      @param {integer} end Index of the last item to return
      @returns {module:asynciterator.AsyncIterator} A new iterator with items in the given range
    */
    range(start, end) {
        return this.transform({ offset: start, limit: Math.max(end - start + 1, 0) });
    }
    /**
      Creates a copy of the current iterator,
      containing all items emitted from this point onward.
      Further copies can be created; they will all start from this same point.
      After this operation, only read the returned copies instead of the original iterator.
      @returns {module:asynciterator.AsyncIterator} A new iterator that contains all future items of this iterator
    */
    clone() {
        return new ClonedIterator(this);
    }
}
// Starts emitting `data` events when `data` listeners are added
function waitForDataListener(eventName) {
    if (eventName === 'data') {
        this.removeListener('newListener', waitForDataListener);
        addSingleListener(this, 'readable', emitData);
        if (this.readable)
            taskScheduler(() => emitData.call(this));
    }
}
// Emits new items though `data` events as long as there are `data` listeners
function emitData() {
    // While there are `data` listeners and items, emit them
    let item;
    while (this.listenerCount('data') !== 0 && (item = this.read()) !== null)
        this.emit('data', item);
    // Stop draining the source if there are no more `data` listeners
    if (this.listenerCount('data') === 0 && !this.done) {
        this.removeListener('readable', emitData);
        addSingleListener(this, 'newListener', waitForDataListener);
    }
}
// Adds the listener to the event, if it has not been added previously.
function addSingleListener(source, eventName, listener) {
    if (!source.listeners(eventName).includes(listener))
        source.on(eventName, listener);
}
/**
  An iterator that doesn't emit any items.
  @extends module:asynciterator.AsyncIterator
*/
class EmptyIterator extends AsyncIterator {
    /** Creates a new `EmptyIterator`. */
    constructor() {
        super();
        this._changeState(ENDED, true);
    }
}
/**
  An iterator that emits a single item.
  @extends module:asynciterator.AsyncIterator
*/
class SingletonIterator extends (/* unused pure expression or super */ null && (AsyncIterator)) {
    /**
      Creates a new `SingletonIterator`.
      @param {object} item The item that will be emitted.
    */
    constructor(item) {
        super();
        this._item = item;
        if (item === null)
            this.close();
        else
            this.readable = true;
    }
    /* Reads the item from the iterator. */
    read() {
        const item = this._item;
        this._item = null;
        this.close();
        return item;
    }
    /* Generates details for a textual representation of the iterator. */
    _toStringDetails() {
        return this._item === null ? '' : `(${this._item})`;
    }
}
/**
  An iterator that emits the items of a given array.
  @extends module:asynciterator.AsyncIterator
*/
class ArrayIterator extends AsyncIterator {
    /**
      Creates a new `ArrayIterator`.
      @param {Array} items The items that will be emitted.
      @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
      @param {boolean} [options.preserve=true] If false, the passed array can be safely modified
    */
    constructor(items = [], { autoStart = true, preserve = true } = {}) {
        super();
        const buffer = preserve || !Array.isArray(items) ? [...items] : items;
        this._index = 0;
        this._sourceStarted = autoStart !== false;
        this._truncateThreshold = preserve ? -1 : 64;
        if (this._sourceStarted && buffer.length === 0)
            this.close();
        else
            this._buffer = buffer;
        this.readable = true;
    }
    /* Reads an item from the iterator. */
    read() {
        if (!this._sourceStarted)
            this._sourceStarted = true;
        let item = null;
        if (this._buffer) {
            // Emit the current item
            if (this._index < this._buffer.length)
                item = this._buffer[this._index++];
            // Close when all elements have been returned
            if (this._index === this._buffer.length) {
                delete this._buffer;
                this.close();
            }
            // Do need keep old items around indefinitely
            else if (this._index === this._truncateThreshold) {
                this._buffer.splice(0, this._truncateThreshold);
                this._index = 0;
            }
        }
        return item;
    }
    /* Generates details for a textual representation of the iterator. */
    _toStringDetails() {
        return `(${this._buffer ? this._buffer.length - this._index : 0})`;
    }
    /* Called by {@link module:asynciterator.AsyncIterator#destroy} */
    _destroy(cause, callback) {
        delete this._buffer;
        callback();
    }
    /**
     Consume all remaining items of the iterator into an array that will be returned asynchronously.
     @param {object} [options] Settings for array creation
     @param {integer} [options.limit] The maximum number of items to place in the array.
     */
    toArray(options = {}) {
        if (!this._buffer)
            return Promise.resolve([]);
        // Determine start and end index
        const { length } = this._buffer;
        const start = this._index;
        const end = typeof options.limit !== 'number' ? length : start + options.limit;
        // Slice the items off the buffer
        const items = this._buffer.slice(start, end);
        this._index = end;
        // Close this iterator when we're past the end
        if (end >= length)
            this.close();
        return Promise.resolve(items);
    }
}
/**
  An iterator that enumerates integers in a certain range.
  @extends module:asynciterator.AsyncIterator
*/
class IntegerIterator extends AsyncIterator {
    /**
      Creates a new `IntegerIterator`.
      @param {object} [options] Settings of the iterator
      @param {integer} [options.start=0] The first number to emit
      @param {integer} [options.end=Infinity] The last number to emit
      @param {integer} [options.step=1] The increment between two numbers
    */
    constructor({ start = 0, step = 1, end } = {}) {
        super();
        // Determine the first number
        if (Number.isFinite(start))
            start = Math.trunc(start);
        this._next = start;
        // Determine step size
        if (Number.isFinite(step))
            step = Math.trunc(step);
        this._step = step;
        // Determine the last number
        const ascending = step >= 0;
        const direction = ascending ? Infinity : -Infinity;
        if (Number.isFinite(end))
            end = Math.trunc(end);
        else if (end !== -direction)
            end = direction;
        this._last = end;
        // Start iteration if there is at least one item; close otherwise
        if (!Number.isFinite(start) || (ascending ? start > end : start < end))
            this.close();
        else
            this.readable = true;
    }
    /* Reads an item from the iterator. */
    read() {
        if (this.closed)
            return null;
        const current = this._next, step = this._step, last = this._last, next = this._next += step;
        if (step >= 0 ? next > last : next < last)
            this.close();
        return current;
    }
    /* Generates details for a textual representation of the iterator. */
    _toStringDetails() {
        return `(${this._next}...${this._last})`;
    }
}
/** Function that maps an element to itself. */
function identity(item) {
    return item;
}
/** Key indicating the current consumer of a source. */
const DESTINATION = Symbol('destination');
/**
 An iterator that synchronously transforms every item from its source
 by applying a mapping function.
 @extends module:asynciterator.AsyncIterator
*/
class MappingIterator extends AsyncIterator {
    /**
     * Applies the given mapping to the source iterator.
     */
    constructor(source, map = identity, options = {}) {
        super();
        this._map = map;
        this._source = ensureSourceAvailable(source);
        this._destroySource = options.destroySource !== false;
        // Close if the source is already empty
        if (source.done) {
            this.close();
        }
        // Otherwise, wire up the source for reading
        else {
            this._source[DESTINATION] = this;
            this._source.on('end', destinationClose);
            this._source.on('error', destinationEmitError);
            this._source.on('readable', destinationSetReadable);
            this.readable = this._source.readable;
        }
    }
    /* Tries to read the next item from the iterator. */
    read() {
        if (!this.done) {
            // Try to read an item that maps to a non-null value
            if (this._source.readable) {
                let item, mapped;
                while ((item = this._source.read()) !== null) {
                    if ((mapped = this._map(item)) !== null)
                        return mapped;
                }
            }
            this.readable = false;
            // Close this iterator if the source is empty
            if (this._source.done)
                this.close();
        }
        return null;
    }
    /* Cleans up the source iterator and ends. */
    _end(destroy) {
        this._source.removeListener('end', destinationClose);
        this._source.removeListener('error', destinationEmitError);
        this._source.removeListener('readable', destinationSetReadable);
        delete this._source[DESTINATION];
        if (this._destroySource)
            this._source.destroy();
        super._end(destroy);
    }
}
// Validates an AsyncIterator for use as a source within another AsyncIterator
function ensureSourceAvailable(source, allowDestination = false) {
    if (!source || !isFunction(source.read) || !isFunction(source.on))
        throw new TypeError(`Invalid source: ${source}`);
    if (!allowDestination && source[DESTINATION])
        throw new Error('The source already has a destination');
    return source;
}
/**
  An iterator that maintains an internal buffer of items.
  This class serves as a base class for other iterators
  with a typically complex item generation process.
  @extends module:asynciterator.AsyncIterator
*/
class BufferedIterator extends AsyncIterator {
    /**
      Creates a new `BufferedIterator`.
      @param {object} [options] Settings of the iterator
      @param {integer} [options.maxBufferSize=4] The number of items to preload in the internal buffer
      @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
    */
    constructor({ maxBufferSize = 4, autoStart = true } = {}) {
        super(INIT);
        this._buffer = new _linkedlist_js__WEBPACK_IMPORTED_MODULE_2__/* .LinkedList */ .S();
        this._maxBufferSize = 4;
        this._reading = true;
        this._pushedCount = 0;
        this.maxBufferSize = maxBufferSize;
        taskScheduler(() => this._init(autoStart));
        this._sourceStarted = autoStart !== false;
    }
    /**
      The maximum number of items to preload in the internal buffer.
      A `BufferedIterator` tries to fill its buffer as far as possible.
      Set to `Infinity` to fully drain the source.
      @type number
    */
    get maxBufferSize() {
        return this._maxBufferSize;
    }
    set maxBufferSize(maxBufferSize) {
        // Allow only positive integers and infinity
        if (maxBufferSize !== Infinity) {
            maxBufferSize = !Number.isFinite(maxBufferSize) ? 4 :
                Math.max(Math.trunc(maxBufferSize), 1);
        }
        // Only set the maximum buffer size if it changes
        if (this._maxBufferSize !== maxBufferSize) {
            this._maxBufferSize = maxBufferSize;
            // Ensure sufficient elements are buffered
            if (this._state === OPEN)
                this._fillBuffer();
        }
    }
    /**
      Initializing the iterator by calling {@link BufferedIterator#_begin}
      and changing state from INIT to OPEN.
      @protected
      @param {boolean} autoStart Whether reading of items should immediately start after OPEN.
    */
    _init(autoStart) {
        // Perform initialization tasks
        let doneCalled = false;
        this._reading = true;
        this._begin(() => {
            if (doneCalled)
                throw new Error('done callback called multiple times');
            doneCalled = true;
            // Open the iterator and start buffering
            this._reading = false;
            this._changeState(OPEN);
            if (autoStart)
                this._fillBufferAsync();
            // If reading should not start automatically, the iterator doesn't become readable.
            // Therefore, mark the iterator as (potentially) readable so consumers know it might be read.
            else
                this.readable = true;
        });
    }
    /**
      Writes beginning items and opens iterator resources.
      Should never be called before {@link BufferedIterator#_init};
      typically, `_init` is responsible for calling `_begin`.
      @protected
      @param {function} done To be called when initialization is complete
    */
    _begin(done) {
        done();
    }
    /**
      Tries to read the next item from the iterator.
      If the buffer is empty,
      this method calls {@link BufferedIterator#_read} to fetch items.
      @returns {object?} The next item, or `null` if none is available
    */
    read() {
        if (this.done)
            return null;
        // An explicit read kickstarts the source
        if (!this._sourceStarted)
            this._sourceStarted = true;
        // Try to retrieve an item from the buffer
        const buffer = this._buffer;
        let item;
        if (buffer.empty) {
            item = null;
            this.readable = false;
        }
        else {
            item = buffer.shift();
        }
        // If the buffer is becoming empty, either fill it or end the iterator
        if (!this._reading && buffer.length < this._maxBufferSize) {
            // If the iterator is not closed and thus may still generate new items, fill the buffer
            if (!this.closed)
                this._fillBufferAsync();
            // No new items will be generated, so if none are buffered, the iterator ends here
            else if (buffer.empty)
                this._endAsync();
        }
        return item;
    }
    /**
      Tries to generate the given number of items.
      Implementers should add `count` items through {@link BufferedIterator#_push}.
      @protected
      @param {integer} count The number of items to generate
      @param {function} done To be called when reading is complete
    */
    _read(count, done) {
        done();
    }
    /**
      Adds an item to the internal buffer.
      @protected
      @param {object} item The item to add
      @emits module:asynciterator.AsyncIterator.readable
    */
    _push(item) {
        if (!this.done) {
            this._pushedCount++;
            this._buffer.push(item);
            this.readable = true;
        }
    }
    /**
      Fills the internal buffer until `this._maxBufferSize` items are present.
      This method calls {@link BufferedIterator#_read} to fetch items.
      @protected
      @emits module:asynciterator.AsyncIterator.readable
    */
    _fillBuffer() {
        let neededItems;
        // Avoid recursive reads
        if (this._reading) {
            // Do nothing
        }
        // If iterator closing started in the meantime, don't generate new items anymore
        else if (this.closed) {
            this._completeClose();
        }
        // Otherwise, try to fill empty spaces in the buffer by generating new items
        else if ((neededItems = Math.min(this._maxBufferSize - this._buffer.length, 128)) > 0) {
            // Acquire reading lock and start reading, counting pushed items
            this._pushedCount = 0;
            this._reading = true;
            this._read(neededItems, () => {
                // Verify the callback is only called once
                if (!neededItems)
                    throw new Error('done callback called multiple times');
                neededItems = 0;
                // Release reading lock
                this._reading = false;
                // If the iterator was closed while reading, complete closing
                if (this.closed) {
                    this._completeClose();
                }
                // If the iterator pushed one or more items,
                // it might currently be able to generate additional items
                // (even though all pushed items might already have been read)
                else if (this._pushedCount) {
                    this.readable = true;
                    // If the buffer is insufficiently full, continue filling
                    if (this._buffer.length < this._maxBufferSize / 2)
                        this._fillBufferAsync();
                }
            });
        }
    }
    /**
      Schedules `_fillBuffer` asynchronously.
    */
    _fillBufferAsync() {
        // Acquire reading lock to avoid recursive reads
        if (!this._reading) {
            this._reading = true;
            taskScheduler(() => {
                // Release reading lock so _fillBuffer` can take it
                this._reading = false;
                this._fillBuffer();
            });
        }
    }
    /**
      Stops the iterator from generating new items
      after a possible pending read operation has finished.
      Already generated, pending, or terminating items can still be emitted.
      After this, the iterator will end asynchronously.
      @emits module:asynciterator.AsyncIterator.end
    */
    close() {
        // If the iterator is not currently reading, we can close immediately
        if (!this._reading)
            this._completeClose();
        // Closing cannot complete when reading, so temporarily assume CLOSING state
        // `_fillBuffer` becomes responsible for calling `_completeClose`
        else
            this._changeState(CLOSING);
    }
    /**
      Stops the iterator from generating new items,
      switching from `CLOSING` state into `CLOSED` state.
      @protected
      @emits module:asynciterator.AsyncIterator.end
    */
    _completeClose() {
        if (this._changeState(CLOSED)) {
            // Write possible terminating items
            this._reading = true;
            this._flush(() => {
                if (!this._reading)
                    throw new Error('done callback called multiple times');
                this._reading = false;
                // If no items are left, end the iterator
                // Otherwise, `read` becomes responsible for ending the iterator
                if (this._buffer.empty)
                    this._endAsync();
            });
        }
    }
    /* Called by {@link module:asynciterator.AsyncIterator#destroy} */
    _destroy(cause, callback) {
        this._buffer.clear();
        callback();
    }
    /**
      Writes terminating items and closes iterator resources.
      Should never be called before {@link BufferedIterator#close};
      typically, `close` is responsible for calling `_flush`.
      @protected
      @param {function} done To be called when termination is complete
    */
    _flush(done) {
        done();
    }
    /**
      Generates details for a textual representation of the iterator.
      @protected
     */
    _toStringDetails() {
        const buffer = this._buffer;
        return `{${buffer.empty ? '' : `next: ${buffer.first}, `}buffer: ${buffer.length}}`;
    }
}
/**
  An iterator that generates items based on a source iterator.
  This class serves as a base class for other iterators.
  @extends module:asynciterator.BufferedIterator
*/
class TransformIterator extends BufferedIterator {
    /**
      Creates a new `TransformIterator`.
      @param {module:asynciterator.AsyncIterator|Readable} [source] The source this iterator generates items from
      @param {object} [options] Settings of the iterator
      @param {integer} [options.maxBufferSize=4] The maximum number of items to keep in the buffer
      @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
      @param {boolean} [options.optional=false] If transforming is optional, the original item is pushed when its transformation yields no items
      @param {boolean} [options.destroySource=true] Whether the source should be destroyed when this transformed iterator is closed or destroyed
      @param {module:asynciterator.AsyncIterator} [options.source] The source this iterator generates items from
    */
    constructor(source, options = source || {}) {
        super(options);
        this._boundPush = (item) => this._push(item);
        // Shift parameters if needed
        if (!isSourceExpression(source))
            source = options.source;
        // The passed source is an AsyncIterator or readable stream
        if (isEventEmitter(source)) {
            this.source = source;
        }
        // The passed value is a promise or source creation function
        else if (source) {
            this._createSource = isPromise(source) ? () => source : source;
            if (this._sourceStarted)
                this._loadSourceAsync();
        }
        // Set other options
        this._optional = Boolean(options.optional);
        this._destroySource = options.destroySource !== false;
    }
    /**
      The source this iterator generates items from.
      @type module:asynciterator.AsyncIterator
    */
    get source() {
        if (isFunction(this._createSource))
            this._loadSourceAsync();
        return this._source;
    }
    set source(value) {
        // Validate and set source
        const source = this._source = this._validateSource(value);
        source[DESTINATION] = this;
        // Do not read the source if this iterator already ended
        if (this.done) {
            if (this._destroySource)
                source.destroy();
        }
        // Close this iterator if the source already ended
        else if (source.done) {
            this.close();
        }
        // Otherwise, react to source events
        else {
            source.on('end', destinationCloseWhenDone);
            source.on('readable', destinationFillBuffer);
            source.on('error', destinationEmitError);
        }
    }
    /**
      Initializes a source that was set through a promise
      @protected
    */
    _loadSourceAsync() {
        if (isFunction(this._createSource)) {
            // Assign the source after resolving
            Promise.resolve(this._createSource()).then(source => {
                delete this._createSource;
                this.source = source;
                this._fillBuffer();
            }, error => this.emit('error', error));
            // Signal that source creation is pending
            this._createSource = null;
        }
    }
    /**
      Validates whether the given iterator can be used as a source.
      @protected
      @param {object} source The source to validate
      @param {boolean} allowDestination Whether the source can already have a destination
    */
    _validateSource(source, allowDestination = false) {
        if (this._source || typeof this._createSource !== 'undefined')
            throw new Error('The source cannot be changed after it has been set');
        return ensureSourceAvailable(source, allowDestination);
    }
    /**
      Tries to read transformed items.
    */
    _read(count, done) {
        const next = () => {
            // Continue transforming until at least `count` items have been pushed
            if (this._pushedCount < count && !this.closed)
                taskScheduler(() => this._readAndTransform(next, done));
            else
                done();
        };
        this._readAndTransform(next, done);
    }
    /**
      Reads a transforms an item
    */
    _readAndTransform(next, done) {
        // If the source exists and still can read items,
        // try to read and transform the next item.
        let item;
        const source = this.source;
        if (!source || source.done || (item = source.read()) === null)
            done();
        else if (!this._optional)
            this._transform(item, next, this._boundPush);
        else
            this._optionalTransform(item, next);
    }
    /**
      Tries to transform the item;
      if the transformation yields no items, pushes the original item.
    */
    _optionalTransform(item, done) {
        const pushedCount = this._pushedCount;
        this._transform(item, () => {
            if (pushedCount === this._pushedCount)
                this._push(item);
            done();
        }, this._boundPush);
    }
    /**
      Generates items based on the item from the source.
      Implementers should add items through {@link BufferedIterator#_push}.
      The default implementation pushes the source item as-is.
      @protected
      @param {object} item The last read item from the source
      @param {function} done To be called when reading is complete
      @param {function} push A callback to push zero or more transformation results.
    */
    _transform(item, done, push) {
        push(item);
        done();
    }
    /**
      Closes the iterator when pending items are transformed.
      @protected
    */
    _closeWhenDone() {
        this.close();
    }
    /* Cleans up the source iterator and ends. */
    _end(destroy) {
        const source = this._source;
        if (source) {
            source.removeListener('end', destinationCloseWhenDone);
            source.removeListener('error', destinationEmitError);
            source.removeListener('readable', destinationFillBuffer);
            delete source[DESTINATION];
            if (this._destroySource)
                source.destroy();
        }
        super._end(destroy);
    }
}
function destinationSetReadable() {
    this[DESTINATION].readable = true;
}
function destinationEmitError(error) {
    this[DESTINATION].emit('error', error);
}
function destinationClose() {
    this[DESTINATION].close();
}
function destinationCloseWhenDone() {
    this[DESTINATION]._closeWhenDone();
}
function destinationFillBuffer() {
    if (this[DESTINATION]._sourceStarted !== false)
        this[DESTINATION]._fillBuffer();
}
/**
  An iterator that generates items based on a source iterator
  and simple transformation steps passed as arguments.
  @extends module:asynciterator.TransformIterator
*/
class SimpleTransformIterator extends TransformIterator {
    /**
      Creates a new `SimpleTransformIterator`.
      @param {module:asynciterator.AsyncIterator|Readable} [source] The source this iterator generates items from
      @param {object|Function} [options] Settings of the iterator, or the transformation function
      @param {integer} [options.maxbufferSize=4] The maximum number of items to keep in the buffer
      @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
      @param {module:asynciterator.AsyncIterator} [options.source] The source this iterator generates items from
      @param {integer} [options.offset] The number of items to skip
      @param {integer} [options.limit] The maximum number of items
      @param {Function} [options.filter] A function to synchronously filter items from the source
      @param {Function} [options.map] A function to synchronously transform items from the source
      @param {Function} [options.transform] A function to asynchronously transform items from the source
      @param {boolean} [options.optional=false] If transforming is optional, the original item is pushed when its mapping yields `null` or its transformation yields no items
      @param {Array|module:asynciterator.AsyncIterator} [options.prepend] Items to insert before the source items
      @param {Array|module:asynciterator.AsyncIterator} [options.append]  Items to insert after the source items
    */
    constructor(source, options) {
        super(source, options);
        this._offset = 0;
        this._limit = Infinity;
        this._filter = (item) => true;
        // Set transformation steps from the options
        options = options || (!isSourceExpression(source) ? source : null);
        if (options) {
            const transform = isFunction(options) ? options : options.transform;
            const { limit, offset, filter, map, prepend, append } = options;
            // Don't emit any items when bounds are unreachable
            if (offset === Infinity || limit === -Infinity) {
                this._limit = 0;
            }
            else {
                if (Number.isFinite(offset))
                    this._offset = Math.max(Math.trunc(offset), 0);
                if (Number.isFinite(limit))
                    this._limit = Math.max(Math.trunc(limit), 0);
                if (isFunction(filter))
                    this._filter = filter;
                if (isFunction(map))
                    this._map = map;
                this._transform = isFunction(transform) ? transform : null;
            }
            if (prepend)
                this._prepender = isEventEmitter(prepend) ? prepend : fromArray(prepend);
            if (append)
                this._appender = isEventEmitter(append) ? append : fromArray(append);
        }
    }
    /* Tries to read and transform items */
    _read(count, done) {
        const next = () => this._readAndTransformSimple(count, nextAsync, done);
        this._readAndTransformSimple(count, nextAsync, done);
        function nextAsync() {
            taskScheduler(next);
        }
    }
    /* Reads and transform items */
    _readAndTransformSimple(count, next, done) {
        // Verify we have a readable source
        let item;
        const { source } = this;
        if (!source || source.done) {
            done();
            return;
        }
        // Verify we are still below the limit
        if (this._limit === 0)
            this.close();
        // Try to read the next item until at least `count` items have been pushed
        while (!this.closed && this._pushedCount < count && (item = source.read()) !== null) {
            // Verify the item passes the filter and we've reached the offset
            if (!this._filter(item) || this._offset !== 0 && this._offset--)
                continue;
            // Synchronously map the item
            const mappedItem = typeof this._map === 'undefined' ? item : this._map(item);
            // Skip `null` items, pushing the original item if the mapping was optional
            if (mappedItem === null) {
                if (this._optional)
                    this._push(item);
            }
            // Skip the asynchronous phase if no transformation was specified
            else if (!isFunction(this._transform)) {
                this._push(mappedItem);
            }
            // Asynchronously transform the item, and wait for `next` to call back
            else {
                if (!this._optional)
                    this._transform(mappedItem, next, this._boundPush);
                else
                    this._optionalTransform(mappedItem, next);
                return;
            }
            // Stop when we've reached the limit
            if (--this._limit === 0)
                this.close();
        }
        done();
    }
    // Prepends items to the iterator
    _begin(done) {
        this._insert(this._prepender, done);
        delete this._prepender;
    }
    // Appends items to the iterator
    _flush(done) {
        this._insert(this._appender, done);
        delete this._appender;
    }
    // Inserts items in the iterator
    _insert(inserter, done) {
        const push = (item) => this._push(item);
        if (!inserter || inserter.done) {
            done();
        }
        else {
            inserter.on('data', push);
            inserter.on('end', end);
        }
        function end() {
            inserter.removeListener('data', push);
            inserter.removeListener('end', end);
            done();
        }
    }
}
/**
  An iterator that generates items by transforming each item of a source
  with a different iterator.
  @extends module:asynciterator.TransformIterator
*/
class MultiTransformIterator extends (/* unused pure expression or super */ null && (TransformIterator)) {
    /**
     Creates a new `MultiTransformIterator`.
     @param {module:asynciterator.AsyncIterator|Readable} [source] The source this iterator generates items from
     @param {object|Function} [options] Settings of the iterator, or the transformation function
     @param {integer} [options.maxbufferSize=4] The maximum number of items to keep in the buffer
     @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
     @param {module:asynciterator.AsyncIterator} [options.source] The source this iterator generates items from
     @param {integer} [options.offset] The number of items to skip
     @param {integer} [options.limit] The maximum number of items
     @param {Function} [options.filter] A function to synchronously filter items from the source
     @param {Function} [options.map] A function to synchronously transform items from the source
     @param {Function} [options.transform] A function to asynchronously transform items from the source
     @param {boolean} [options.optional=false] If transforming is optional, the original item is pushed when its mapping yields `null` or its transformation yields no items
     @param {Function} [options.multiTransform] A function to asynchronously transform items to iterators from the source
     @param {Array|module:asynciterator.AsyncIterator} [options.prepend] Items to insert before the source items
     @param {Array|module:asynciterator.AsyncIterator} [options.append]  Items to insert after the source items
     */
    constructor(source, options) {
        super(source, options);
        this._transformerQueue = [];
        // Set transformation steps from the options
        if (options) {
            const multiTransform = isFunction(options) ? options : options.multiTransform;
            if (multiTransform)
                this._createTransformer = multiTransform;
        }
    }
    /* Tries to read and transform items */
    _read(count, done) {
        // Remove transformers that have ended
        const transformerQueue = this._transformerQueue, optional = this._optional;
        let head, item;
        while ((head = transformerQueue[0]) && head.transformer.done) {
            // If transforming is optional, push the original item if none was pushed
            if (optional && head.item !== null) {
                count--;
                this._push(head.item);
            }
            // Remove listeners from the transformer
            transformerQueue.shift();
            const { transformer } = head;
            transformer.removeListener('end', destinationFillBuffer);
            transformer.removeListener('readable', destinationFillBuffer);
            transformer.removeListener('error', destinationEmitError);
        }
        // Create new transformers if there are less than the maximum buffer size
        const { source } = this;
        while (source && !source.done && transformerQueue.length < this.maxBufferSize) {
            // Read an item to create the next transformer
            item = source.read();
            if (item === null)
                break;
            // Create the transformer and listen to its events
            const transformer = (this._createTransformer(item) ||
                new EmptyIterator());
            transformer[DESTINATION] = this;
            transformer.on('end', destinationFillBuffer);
            transformer.on('readable', destinationFillBuffer);
            transformer.on('error', destinationEmitError);
            transformerQueue.push({ transformer, item });
        }
        // Try to read `count` items from the transformer
        head = transformerQueue[0];
        if (head) {
            const { transformer } = head;
            while (count-- > 0 && (item = transformer.read()) !== null) {
                this._push(item);
                // If a transformed item was pushed, no need to push the original anymore
                if (optional)
                    head.item = null;
            }
        }
        // End the iterator if the source has ended
        else if (source && source.done) {
            this.close();
        }
        done();
    }
    /**
      Creates a transformer for the given item.
      @param {object} item The last read item from the source
      @returns {module:asynciterator.AsyncIterator} An iterator that transforms the given item
    */
    _createTransformer(item) {
        return new SingletonIterator(item);
    }
    /* Closes the iterator when pending items are transformed. */
    _closeWhenDone() {
        // Only close if all transformers are read
        if (!this._transformerQueue.length)
            this.close();
    }
    _end(destroy) {
        super._end(destroy);
        // Also destroy the open transformers left in the queue
        if (this._destroySource) {
            for (const item of this._transformerQueue)
                item.transformer.destroy();
        }
    }
}
/**
  An iterator that generates items by reading from multiple other iterators.
  @extends module:asynciterator.BufferedIterator
*/
class UnionIterator extends (/* unused pure expression or super */ null && (BufferedIterator)) {
    /**
      Creates a new `UnionIterator`.
      @param {module:asynciterator.AsyncIterator|Array} [sources] The sources to read from
      @param {object} [options] Settings of the iterator
      @param {boolean} [options.destroySource=true] Whether the sources should be destroyed when transformed iterator is closed or destroyed
    */
    constructor(sources, options = {}) {
        super(options);
        this._sources = [];
        this._currentSource = -1;
        const autoStart = options.autoStart !== false;
        // Sources have been passed as an iterator
        if (isEventEmitter(sources)) {
            sources.on('error', error => this.emit('error', error));
            this._pending = { loading: false, sources: sources };
            if (autoStart)
                this._loadSources();
        }
        // Sources have been passed as a non-empty array
        else if (Array.isArray(sources) && sources.length > 0) {
            for (const source of sources)
                this._addSource(source);
        }
        // Sources are an empty list
        else if (autoStart) {
            this.close();
        }
        // Set other options
        this._destroySources = options.destroySources !== false;
    }
    // Loads pending sources into the sources list
    _loadSources() {
        // Obtain sources iterator
        const sources = this._pending.sources;
        this._pending.loading = true;
        // Close immediately if done
        if (sources.done) {
            delete this._pending;
            this.close();
        }
        // Otherwise, set up source reading
        else {
            sources.on('data', source => {
                this._addSource(source);
                this._fillBufferAsync();
            });
            sources.on('end', () => {
                delete this._pending;
                this._fillBuffer();
            });
        }
    }
    // Adds the given source to the internal sources array
    _addSource(source) {
        if (isPromise(source))
            source = wrap(source);
        if (!source.done) {
            this._sources.push(source);
            source[DESTINATION] = this;
            source.on('error', destinationEmitError);
            source.on('readable', destinationFillBuffer);
            source.on('end', destinationRemoveEmptySources);
        }
    }
    // Removes sources that will no longer emit items
    _removeEmptySources() {
        this._sources = this._sources.filter((source, index) => {
            // Adjust the index of the current source if needed
            if (source.done && index <= this._currentSource)
                this._currentSource--;
            return !source.done;
        });
        this._fillBuffer();
    }
    // Reads items from the next sources
    _read(count, done) {
        var _a;
        // Start source loading if needed
        if (((_a = this._pending) === null || _a === void 0 ? void 0 : _a.loading) === false)
            this._loadSources();
        // Try to read `count` items
        let lastCount = 0, item;
        while (lastCount !== (lastCount = count)) {
            // Try every source at least once
            for (let i = 0; i < this._sources.length && count > 0; i++) {
                // Pick the next source
                this._currentSource = (this._currentSource + 1) % this._sources.length;
                const source = this._sources[this._currentSource];
                // Attempt to read an item from that source
                if ((item = source.read()) !== null) {
                    count--;
                    this._push(item);
                }
            }
        }
        // Close this iterator if all of its sources have been read
        if (!this._pending && this._sources.length === 0)
            this.close();
        done();
    }
    _end(destroy = false) {
        super._end(destroy);
        // Destroy all sources that are still readable
        if (this._destroySources) {
            for (const source of this._sources)
                source.destroy();
            // Also close the sources stream if applicable
            if (this._pending) {
                this._pending.sources.destroy();
                delete this._pending;
            }
        }
    }
}
function destinationRemoveEmptySources() {
    this[DESTINATION]._removeEmptySources();
}
/**
  An iterator that copies items from another iterator.
  @extends module:asynciterator.TransformIterator
*/
class ClonedIterator extends TransformIterator {
    /**
      Creates a new `ClonedIterator`.
      @param {module:asynciterator.AsyncIterator|Readable} [source] The source this iterator copies items from
    */
    constructor(source) {
        super(source, { autoStart: false });
        this._readPosition = 0;
        this._reading = false;
    }
    _init() {
        // skip buffered iterator initialization, since we read from history
    }
    close() {
        // skip buffered iterator cleanup
        AsyncIterator.prototype.close.call(this);
    }
    // The source this iterator copies items from
    get source() {
        return super.source;
    }
    set source(value) {
        // Validate and set the source
        const source = this._source = this._validateSource(value);
        // Create a history reader for the source if none already existed
        const history = (source && source[DESTINATION]) ||
            (source[DESTINATION] = new HistoryReader(source));
        // Do not read the source if this iterator already ended
        if (this.done) {
            if (this._destroySource)
                source.destroy();
        }
        // Close this clone if history is empty and the source has ended
        else if (history.endsAt(0)) {
            this.close();
        }
        else {
            // Subscribe to history events
            history.register(this);
            // If there are already items in history, this clone is readable
            // If the source has a lazy start, always mark this iterator as readable without eagerly triggering a read.
            if (source._sourceStarted === false || history.readAt(0) !== null)
                this.readable = true;
        }
        // Hook pending property callbacks to the source
        const propertyCallbacks = this._propertyCallbacks;
        for (const propertyName in propertyCallbacks) {
            const callbacks = propertyCallbacks[propertyName];
            for (const callback of callbacks)
                this._getSourceProperty(propertyName, callback);
        }
    }
    /**
      Validates whether the given iterator can be used as a source.
      @protected
      @param {object} source The source to validate
      @param {boolean} allowDestination Whether the source can already have a destination
    */
    _validateSource(source, allowDestination = false) {
        const history = (source && source[DESTINATION]);
        return super._validateSource(source, !history || history instanceof HistoryReader);
    }
    // Retrieves the property with the given name from the clone or its source.
    getProperty(propertyName, callback) {
        const { source } = this, properties = this._properties, hasProperty = properties && (propertyName in properties);
        // If no callback was passed, return the property value
        if (!callback) {
            return hasProperty ? properties && properties[propertyName] :
                source && source.getProperty(propertyName);
        }
        // Try to look up the property in this clone
        super.getProperty(propertyName, callback);
        // If the property is not set on this clone, it might become set on the source first
        if (source && !hasProperty)
            this._getSourceProperty(propertyName, callback);
        return undefined;
    }
    // Retrieves the property with the given name from the source
    _getSourceProperty(propertyName, callback) {
        this.source.getProperty(propertyName, value => {
            // Only send the source's property if it was not set on the clone in the meantime
            if (!this._properties || !(propertyName in this._properties))
                callback(value);
        });
    }
    // Retrieves all properties of the iterator and its source.
    getProperties() {
        const base = this.source ? this.source.getProperties() : {}, properties = this._properties;
        for (const name in properties)
            base[name] = properties[name];
        return base;
    }
    /* Generates details for a textual representation of the iterator. */
    _toStringDetails() {
        return `{source: ${this.source ? this.source.toString() : 'none'}}`;
    }
    /* Tries to read an item */
    read() {
        // An explicit read kickstarts the source
        if (!this._sourceStarted)
            this._sourceStarted = true;
        const source = this.source;
        let item = null;
        if (!this.done && source) {
            // Try to read an item at the current point in history
            const history = source[DESTINATION];
            if ((item = history.readAt(this._readPosition)) !== null)
                this._readPosition++;
            else
                this.readable = false;
            // Close the iterator if we are at the end of the source
            if (history.endsAt(this._readPosition))
                this.close();
        }
        return item;
    }
    /* End the iterator and cleans up. */
    _end(destroy) {
        // Unregister from a possible history reader
        const source = this.source;
        const history = source === null || source === void 0 ? void 0 : source[DESTINATION];
        if (history)
            history.unregister(this);
        // Don't call TransformIterator#_end,
        // as it would make the source inaccessible for other clones
        BufferedIterator.prototype._end.call(this, destroy);
    }
}
// Stores the history of a source, so it can be cloned
class HistoryReader {
    constructor(source) {
        this._history = [];
        this._trackers = new Set();
        this._source = source;
        // If the source is still live, set up clone tracking;
        // otherwise, the clones just read from the finished history
        if (!source.done) {
            // When the source becomes readable, makes all clones readable
            const setReadable = () => {
                for (const tracker of this._trackers)
                    tracker.readable = true;
            };
            // When the source errors, re-emits the error
            const emitError = (error) => {
                for (const tracker of this._trackers)
                    tracker.emit('error', error);
            };
            // When the source ends, closes all clones that are fully read
            const end = () => {
                // Close the clone if all items had been emitted
                for (const tracker of this._trackers) {
                    if (tracker._sourceStarted !== false &&
                        tracker._readPosition === this._history.length)
                        tracker.close();
                }
                this._trackers.clear();
                // Remove source listeners, since no further events will be emitted
                source.removeListener('end', end);
                source.removeListener('error', emitError);
                source.removeListener('readable', setReadable);
            };
            // Listen to source events to trigger events in subscribed clones
            source.on('end', end);
            source.on('error', emitError);
            source.on('readable', setReadable);
        }
    }
    // Registers a clone for history updates
    register(clone) {
        // Tracking is only needed if the source is still live
        if (!this._source.done)
            this._trackers.add(clone);
    }
    // Unregisters a clone for history updates
    unregister(clone) {
        this._trackers.delete(clone);
    }
    // Tries to read the item at the given history position
    readAt(pos) {
        let item = null;
        // Retrieve an item from history when available
        if (pos < this._history.length)
            item = this._history[pos];
        // Read a new item from the source when possible
        else if (!this._source.done && (item = this._source.read()) !== null)
            this._history[pos] = item;
        return item;
    }
    // Determines whether the given position is the end of the source
    endsAt(pos) {
        return this._source.done && this._history.length === pos;
    }
}
/**
 * An iterator that takes a variety of iterable objects as a source.
 */
class WrappingIterator extends AsyncIterator {
    constructor(source, opts) {
        super();
        this._source = null;
        this._destroySource = (opts === null || opts === void 0 ? void 0 : opts.destroySource) !== false;
        // If promise, set up a temporary source and replace when ready
        if (isPromise(source)) {
            this._source = new AsyncIterator();
            source.then(value => {
                this._source = null;
                this.source = value;
            }).catch(error => this.emit('error', error));
        }
        // Otherwise, set the source synchronously
        else if (source) {
            this.source = source;
        }
    }
    set source(value) {
        let source = value;
        if (this._source !== null)
            throw new Error('The source cannot be changed after it has been set');
        // Process an iterable source
        if (isIterable(source))
            source = source[Symbol.iterator]();
        // Process an iterator source
        if (isIterator(source)) {
            let iterator = source;
            source = new events__WEBPACK_IMPORTED_MODULE_0__.EventEmitter();
            source.read = () => {
                if (iterator !== null) {
                    // Skip any null values inside of the iterator
                    let next;
                    while (!(next = iterator.next()).done) {
                        if (next.value !== null)
                            return next.value;
                    }
                    // No remaining values, so stop iterating
                    iterator = null;
                    this.close();
                }
                return null;
            };
        }
        // Process any other readable source
        else {
            source = ensureSourceAvailable(source);
        }
        // Do not change sources if the iterator is already done
        if (this.done) {
            if (this._destroySource && isFunction(source.destroy))
                source.destroy();
            return;
        }
        // Set up event handling
        source[DESTINATION] = this;
        source.on('end', destinationClose);
        source.on('error', destinationEmitError);
        source.on('readable', destinationSetReadable);
        // Enable reading from source
        this._source = source;
        this.readable = source.readable !== false;
    }
    read() {
        if (this._source !== null && this._source.readable !== false) {
            const item = this._source.read();
            if (item !== null)
                return item;
            this.readable = false;
        }
        return null;
    }
    _end(destroy = false) {
        if (this._source !== null) {
            this._source.removeListener('end', destinationClose);
            this._source.removeListener('error', destinationEmitError);
            this._source.removeListener('readable', destinationSetReadable);
            delete this._source[DESTINATION];
            if (this._destroySource && isFunction(this._source.destroy))
                this._source.destroy();
            this._source = null;
        }
        super._end(destroy);
    }
}
/**
  Creates an iterator that wraps around a given iterator or readable stream.
  Use this to convert an iterator-like object into a full-featured AsyncIterator.
  After this operation, only read the returned iterator instead of the given one.
  @function
  @param [source] The source this iterator generates items from
  @param {object} [options] Settings of the iterator
  @returns {module:asynciterator.AsyncIterator} A new iterator with the items from the given iterator
*/
function wrap(source, options) {
    // For backward compatibility, always use TransformIterator when options are specified
    if (options && ('autoStart' in options || 'optional' in options || 'source' in options || 'maxBufferSize' in options)) {
        if (source && !isEventEmitter(source))
            source = new WrappingIterator(source);
        return new TransformIterator(source, options);
    }
    // Empty iterator if no source specified
    if (!source)
        return empty();
    // Unwrap promised sources
    if (isPromise(source))
        return new WrappingIterator(source, options);
    // Directly return any AsyncIterator
    if (source instanceof AsyncIterator)
        return source;
    // Other iterable objects
    if (Array.isArray(source))
        return fromArray(source);
    if (isIterable(source) || isIterator(source) || isEventEmitter(source))
        return new WrappingIterator(source, options);
    // Other types are unsupported
    throw new TypeError(`Invalid source: ${source}`);
}
/**
  Creates an empty iterator.
 */
function empty() {
    return new EmptyIterator();
}
/**
  Creates an iterator with a single item.
  @param {object} item the item
 */
function single(item) {
    return new SingletonIterator(item);
}
/**
  Creates an iterator for the given array.
  @param {Array} items the items
 */
function fromArray(items) {
    return new ArrayIterator(items);
}
/**
 Creates an iterator for the given Iterator.
 @param {Iterable} source the iterator
 */
function fromIterator(source) {
    return new WrappingIterator(source);
}
/**
 Creates an iterator for the given Iterable.
 @param {Iterable} source the iterable
 */
function fromIterable(source) {
    return new WrappingIterator(source);
}
/**
  Creates an iterator containing all items from the given iterators.
  @param {Array} items the items
 */
function union(sources) {
    return new UnionIterator(sources);
}
/**
  Creates an iterator of integers for the given numeric range.
  @param {Array} items the items
 */
function range(start, end, step) {
    return new IntegerIterator({ start, end, step });
}
// Returns a function that calls `fn` with `self` as `this` pointer. */
function bind(fn, self) {
    return self ? fn.bind(self) : fn;
}
// Determines whether the given object is a function
function isFunction(object) {
    return typeof object === 'function';
}
// Determines whether the given object is an EventEmitter
function isEventEmitter(object) {
    return isFunction(object === null || object === void 0 ? void 0 : object.on);
}
// Determines whether the given object is a promise
function isPromise(object) {
    return isFunction(object === null || object === void 0 ? void 0 : object.then);
}
// Determines whether the given object is a source expression
function isSourceExpression(object) {
    return object && (isEventEmitter(object) || isPromise(object) || isFunction(object));
}
// Determines whether the given object supports the iterable protocol
function isIterable(object) {
    return object && (Symbol.iterator in object);
}
// Determines whether the given object supports the iterator protocol
function isIterator(object) {
    return isFunction(object === null || object === void 0 ? void 0 : object.next);
}


/***/ }),

/***/ "../../node_modules/asynciterator/dist/linkedlist.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "S": () => (/* binding */ LinkedList)
/* harmony export */ });
/**
 * A list with O(1) push and shift operations.
 */
class LinkedList {
    constructor() {
        this._length = 0;
        this._head = null;
        this._tail = null;
    }
    get length() { return this._length; }
    get first() { var _a; return (_a = this._head) === null || _a === void 0 ? void 0 : _a.value; }
    get last() { var _a; return (_a = this._tail) === null || _a === void 0 ? void 0 : _a.value; }
    get empty() { return this._head === null; }
    push(value) {
        const node = { value, next: null };
        if (this._tail === null)
            this._head = this._tail = node;
        else
            this._tail.next = this._tail = node;
        this._length++;
    }
    shift() {
        if (this._head === null)
            return undefined;
        const { value, next } = this._head;
        this._head = next;
        if (next === null)
            this._tail = null;
        this._length--;
        return value;
    }
    clear() {
        this._length = 0;
        this._head = this._tail = null;
    }
}


/***/ }),

/***/ "../../node_modules/asynciterator/dist/taskscheduler.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "r": () => (/* binding */ createTaskScheduler)
/* harmony export */ });
const resolved = Promise.resolve(undefined);
// Returns a function that asynchronously schedules a task
function createTaskScheduler() {
    // Use or create a microtask scheduler
    const scheduleMicrotask = typeof queueMicrotask === 'function' ?
        queueMicrotask : (task) => resolved.then(task);
    // Use or create a macrotask scheduler
    const scheduleMacrotask = typeof setImmediate === 'function' ?
        setImmediate : (task) => setTimeout(task, 0);
    // Interrupt with a macrotask every once in a while to avoid freezing
    let i = 0;
    let queue = null;
    return (task) => {
        // Tasks are currently being queued to avoid freezing
        if (queue !== null)
            queue.push(task);
        // Tasks are being scheduled normally as microtasks
        else if (++i < 100)
            scheduleMicrotask(task);
        // A macrotask interruption is needed
        else {
            // Hold all tasks in a queue, and reschedule them after a macrotask
            queue = [task];
            scheduleMacrotask(() => {
                // Work through the queue
                for (const queued of queue)
                    scheduleMicrotask(queued);
                queue = null;
                // Reset the interruption schedule
                i = 0;
            });
        }
    };
}


/***/ }),

/***/ "../../node_modules/chai/index.mjs":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "l_": () => (/* binding */ expect)
/* harmony export */ });
/* unused harmony exports version, Assertion, AssertionError, util, config, use, should, assert, core */
/* harmony import */ var _index_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/chai/index.js");


const expect = _index_js__WEBPACK_IMPORTED_MODULE_0__.expect;
const version = _index_js__WEBPACK_IMPORTED_MODULE_0__.version;
const Assertion = _index_js__WEBPACK_IMPORTED_MODULE_0__.Assertion;
const AssertionError = _index_js__WEBPACK_IMPORTED_MODULE_0__.AssertionError;
const util = _index_js__WEBPACK_IMPORTED_MODULE_0__.util;
const config = _index_js__WEBPACK_IMPORTED_MODULE_0__.config;
const use = _index_js__WEBPACK_IMPORTED_MODULE_0__.use;
const should = _index_js__WEBPACK_IMPORTED_MODULE_0__.should;
const assert = _index_js__WEBPACK_IMPORTED_MODULE_0__.assert;
const core = _index_js__WEBPACK_IMPORTED_MODULE_0__.core;

/* unused harmony default export */ var __WEBPACK_DEFAULT_EXPORT__ = ((/* unused pure expression or super */ null && (chai)));


/***/ }),

/***/ "../backends/browserlevel.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "O": () => (/* binding */ runBrowserLevelTests)
/* harmony export */ });
/* harmony import */ var browser_level__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/browser-level/index.js");
/* harmony import */ var rdf_data_factory__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/rdf-data-factory/index.js");
/* harmony import */ var _dist_esm_utils_uid_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/utils/uid.js");
/* harmony import */ var _quadstore_quadstore_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../quadstore/quadstore.js");




const runBrowserLevelTests = () => {
    describe('BrowserLevel backend', () => {
        beforeEach(async function () {
            this.db = new browser_level__WEBPACK_IMPORTED_MODULE_0__/* .BrowserLevel */ .v(`quadstore-${(0,_dist_esm_utils_uid_js__WEBPACK_IMPORTED_MODULE_2__/* .uid */ .h)()}`);
            this.indexes = null;
            this.dataFactory = new rdf_data_factory__WEBPACK_IMPORTED_MODULE_1__.DataFactory();
            this.prefixes = {
                expandTerm: (term) => term,
                compactIri: (iri) => iri,
            };
        });
        (0,_quadstore_quadstore_js__WEBPACK_IMPORTED_MODULE_3__/* .runQuadstoreTests */ .o)();
    });
};


/***/ }),

/***/ "../backends/memorylevel.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "D": () => (/* binding */ runMemoryLevelTests)
/* harmony export */ });
/* harmony import */ var memory_level__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/memory-level/index.js");
/* harmony import */ var rdf_data_factory__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/rdf-data-factory/index.js");
/* harmony import */ var _quadstore_quadstore_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../quadstore/quadstore.js");



const runMemoryLevelTests = () => {
    describe('MemoryLevel backend', () => {
        beforeEach(async function () {
            this.db = new memory_level__WEBPACK_IMPORTED_MODULE_0__/* .MemoryLevel */ .h();
            this.indexes = null;
            this.dataFactory = new rdf_data_factory__WEBPACK_IMPORTED_MODULE_1__.DataFactory();
            this.prefixes = {
                expandTerm: (term) => term,
                compactIri: (iri) => iri,
            };
        });
        (0,_quadstore_quadstore_js__WEBPACK_IMPORTED_MODULE_2__/* .runQuadstoreTests */ .o)();
    });
};


/***/ }),

/***/ "../others/consumeinbatches.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "P": () => (/* binding */ runConsumeInBatchesTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _utils_stuff_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../utils/stuff.js");
/* harmony import */ var _dist_esm_utils_consumeinbatches_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../dist/esm/utils/consumeinbatches.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../utils/expect.js");




const createSourceIterator = () => new asynciterator__WEBPACK_IMPORTED_MODULE_1__/* .IntegerIterator */ .ye({ start: 0, step: 1, end: 99 });
const runConsumeInBatchesTests = () => {
    describe('consumeInBatches()', () => {
        let source;
        let batchSize;
        const runTests = () => {
            it('should work with a batchSize of 1', () => {
                batchSize = 1;
            });
            it('should work with a batchSize equal to the total number of items', () => {
                batchSize = 100;
            });
            it('should work with a batchSize that is a perfect divisor of the number of items', () => {
                batchSize = 10;
            });
            it('should work with a batchSize that is not a perfect divisor of the number of items (1)', () => {
                batchSize = 13;
            });
            it('should work with a batchSize that is not a perfect divisor of the number of items (2)', () => {
                batchSize = 67;
            });
        };
        afterEach(async () => {
            let itemValue = 0;
            let itemCount = 0;
            let batchCount = 0;
            let last = false;
            await (0,_dist_esm_utils_consumeinbatches_js__WEBPACK_IMPORTED_MODULE_2__/* .consumeInBatches */ .f)(source, batchSize, async (batch) => {
                await new Promise((resolve) => setTimeout(resolve, 1));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toBeFalse */ .kJ)(last);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toBeLessThanOrEqualTo */ .PI)(batch.length, batchSize);
                last = batch.length < batchSize;
                itemCount += batch.length;
                batchCount += 1;
                for (let i = 0; i < batch.length; i += 1) {
                    (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toStrictlyEqual */ .k0)(batch[i], itemValue++);
                }
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toStrictlyEqual */ .k0)(itemCount, 100);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toStrictlyEqual */ .k0)(batchCount, Math.ceil(100 / batchSize));
        });
        describe('with an IntegerIterator as the source', () => {
            beforeEach(() => {
                source = createSourceIterator();
            });
            runTests();
        });
        describe('with an asynchronous IntegerIterator as the source', () => {
            beforeEach(() => {
                source = (0,_utils_stuff_js__WEBPACK_IMPORTED_MODULE_3__/* .delayIterator */ .BY)(createSourceIterator(), 2);
            });
            runTests();
        });
    });
};


/***/ }),

/***/ "../others/consumeonebyone.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Q": () => (/* binding */ runConsumeOneByOneTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _utils_stuff_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../utils/stuff.js");
/* harmony import */ var _dist_esm_utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/utils/consumeonebyone.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../utils/expect.js");




const createSourceIterator = () => new asynciterator__WEBPACK_IMPORTED_MODULE_1__/* .IntegerIterator */ .ye({ start: 0, step: 1, end: 99 });
const runConsumeOneByOneTests = () => {
    describe('consumeOneByOne()', () => {
        let source;
        it('should consume an IntegerIterator', () => {
            source = createSourceIterator();
        });
        it('should consume an asynchronous IntegerIterator', () => {
            source = (0,_utils_stuff_js__WEBPACK_IMPORTED_MODULE_2__/* .delayIterator */ .BY)(createSourceIterator());
        });
        afterEach(async () => {
            let count = 0;
            await (0,_dist_esm_utils_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_3__/* .consumeOneByOne */ ._)(source, async (item) => {
                await new Promise((resolve) => setTimeout(resolve, 1));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toStrictlyEqual */ .k0)(item, count++);
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toStrictlyEqual */ .k0)(count, 100);
        });
    });
};


/***/ }),

/***/ "../others/fpstring.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "L": () => (/* binding */ runFpstringTests)
/* harmony export */ });
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../utils/expect.js");
/* harmony import */ var _dist_esm_serialization_fpstring_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/serialization/fpstring.js");


const runFpstringTests = () => {
    describe('Floating-point serialization', () => {
        it('should produce strings whose lexicographical sorting matches the natural sorting of the original values', async () => {
            const values = [
                -123123,
                -123.123,
                -9.1,
                -9,
                -2.123,
                -1.23,
                -1,
                -0.2123
                    - 0.123,
                -0.1,
                0,
                0.1,
                0.123,
                0.2123,
                1,
                1.23,
                2.123,
                9,
                9.1,
                123.123,
                123123,
            ];
            const shuffled = [
                0,
                123.123,
                -123.123,
                0.2123,
                -9.1,
                -1,
                0.123,
                9,
                -0.3353,
                123123,
                -123123,
                -1.23,
                -0.1,
                2.123,
                -9,
                -2.123,
                9.1,
                0.1,
                1,
                1.23
            ];
            const pairs = shuffled.map(n => [n, (0,_dist_esm_serialization_fpstring_js__WEBPACK_IMPORTED_MODULE_1__/* .encode */ .c)(n)]);
            pairs.sort((p1, p2) => p1[1] < p2[1] ? -1 : 1);
            pairs.forEach((p, i) => {
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toStrictlyEqual */ .k0)(p[0], values[i]);
            });
        });
    });
};


/***/ }),

/***/ "../others/others.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "R": () => (/* binding */ runOtherTests)
/* harmony export */ });
/* harmony import */ var _fpstring_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../others/fpstring.js");
/* harmony import */ var _consumeonebyone_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../others/consumeonebyone.js");
/* harmony import */ var _consumeinbatches_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../others/consumeinbatches.js");



const runOtherTests = () => {
    (0,_fpstring_js__WEBPACK_IMPORTED_MODULE_0__/* .runFpstringTests */ .L)();
    (0,_consumeonebyone_js__WEBPACK_IMPORTED_MODULE_1__/* .runConsumeOneByOneTests */ .Q)();
    (0,_consumeinbatches_js__WEBPACK_IMPORTED_MODULE_2__/* .runConsumeInBatchesTests */ .P)();
};


/***/ }),

/***/ "../quadstore/del.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "N": () => (/* binding */ runDelTests)
/* harmony export */ });
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../utils/expect.js");

const runDelTests = () => {
    describe('Quadstore.prototype.del()', () => {
        it('should delete a quad correctly', async function () {
            const { dataFactory, store } = this;
            const quads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
            await store.multiPut(quads);
            const { items: quadsBefore } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .equalsQuadArray */ .EM)(quadsBefore, quads);
            await store.del(quadsBefore[0]);
            const { items: quadsAfter } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .equalsQuadArray */ .EM)(quadsAfter, [quads[1]]);
        });
    });
    describe('Quadstore.prototype.multiDel()', () => {
        it('should delete a quad correctly', async function () {
            const { dataFactory, store } = this;
            const quads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
            await store.multiPut(quads);
            const { items: quadsBefore } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .equalsQuadArray */ .EM)(quadsBefore, quads);
            await store.multiDel([quadsBefore[0]]);
            const { items: quadsAfter } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .equalsQuadArray */ .EM)(quadsAfter, [quads[1]]);
        });
    });
};


/***/ }),

/***/ "../quadstore/get.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "h": () => (/* binding */ runGetTests)
/* harmony export */ });
/* harmony import */ var _dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/serialization/xsd.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../utils/expect.js");


const runGetTests = () => {
    describe('Quadstore.prototype.get()', () => {
        beforeEach(async function () {
            const { dataFactory } = this;
            this.quads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://c')),
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://c2')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://c')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://c')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://c2')),
                dataFactory.quad(dataFactory.namedNode('ex://s3'), dataFactory.namedNode('ex://p3'), dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)), dataFactory.namedNode('ex://c3')),
                dataFactory.quad(dataFactory.namedNode('ex://s4'), dataFactory.namedNode('ex://p4'), dataFactory.literal('Hello, World', 'en-us'), dataFactory.namedNode('ex://c4')),
            ];
            await this.store.multiPut(this.quads);
        });
        it('should match quads by subject', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, this.quads.slice(0, 2));
        });
        it('should match quads by predicate', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                predicate: dataFactory.namedNode('ex://p'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[0], ...this.quads.slice(2, 4)]);
        });
        it('should match quads by object', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                object: dataFactory.namedNode('ex://o'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[0], this.quads[2]]);
        });
        it('should match quads by object where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match quads by object where object is a language-tagged string', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                object: dataFactory.literal('Hello, World', 'en-us'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[6]]);
        });
        it('should match quads by graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                graph: dataFactory.namedNode('ex://c')
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[0], ...this.quads.slice(2, 4)]);
        });
        it('should match quads by subject and predicate', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s2'),
                predicate: dataFactory.namedNode('ex://p'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[2], this.quads[3]]);
        });
        it('should match quads by subject and object', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s2'),
                object: dataFactory.namedNode('ex://o'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[2]]);
        });
        it('should match quads by subject and object where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s3'),
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match quads by subject and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s2'),
                graph: dataFactory.namedNode('ex://c'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[2], this.quads[3]]);
        });
        it('should match quads by predicate and object', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                predicate: dataFactory.namedNode('ex://p'),
                object: dataFactory.namedNode('ex://o'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[0], this.quads[2]]);
        });
        it('should match quads by predicate and object where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                predicate: dataFactory.namedNode('ex://p3'),
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match quads by predicate and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                predicate: dataFactory.namedNode('ex://p'),
                graph: dataFactory.namedNode('ex://c'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[0], ...this.quads.slice(2, 4)]);
        });
        it('should match quads by object and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                object: dataFactory.namedNode('ex://o2'),
                graph: dataFactory.namedNode('ex://c2'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[1], this.quads[4]]);
        });
        it('should match quads by subject, predicate and object', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s'),
                predicate: dataFactory.namedNode('ex://p2'),
                object: dataFactory.namedNode('ex://o2'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[1]]);
        });
        it('should match quads by subject, predicate and object where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s3'),
                predicate: dataFactory.namedNode('ex://p3'),
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match quads by subject, predicate and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s'),
                predicate: dataFactory.namedNode('ex://p2'),
                graph: dataFactory.namedNode('ex://c2'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[1]]);
        });
        it('should match quads by subject, object and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s'),
                object: dataFactory.namedNode('ex://o2'),
                graph: dataFactory.namedNode('ex://c2'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[1]]);
        });
        it('should match quads by predicate, object and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                predicate: dataFactory.namedNode('ex://p2'),
                object: dataFactory.namedNode('ex://o2'),
                graph: dataFactory.namedNode('ex://c2'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[1], this.quads[4]]);
        });
        it('should match quads by predicate, object and graph where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                predicate: dataFactory.namedNode('ex://p3'),
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
                graph: dataFactory.namedNode('ex://c3'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match quads by subject, predicate, object and graph', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s2'),
                predicate: dataFactory.namedNode('ex://p2'),
                object: dataFactory.namedNode('ex://o2'),
                graph: dataFactory.namedNode('ex://c2'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[4]]);
        });
        it('should match quads by subject, predicate, object and graph where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s3'),
                predicate: dataFactory.namedNode('ex://p3'),
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
                graph: dataFactory.namedNode('ex://c3'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match quads by subject, predicate, object and graph where object is a numeric literal', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://s3'),
                predicate: dataFactory.namedNode('ex://p3'),
                object: dataFactory.literal('44', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .integer */ ._L)),
                graph: dataFactory.namedNode('ex://c3'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, [this.quads[5]]);
        });
        it('should match zero quads when provided with an unknown subject', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://unknown'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, []);
        });
        it('should match zero quads when provided with an unknown subject and a known predicate', async function () {
            const { dataFactory, store } = this;
            const { items: quads } = await store.get({
                subject: dataFactory.namedNode('ex://unknown'),
                predicate: dataFactory.namedNode('ex://p3'),
            });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(quads, []);
        });
    });
    describe('Quadstore.prototype.get() w/ order', () => {
        beforeEach(async function () {
            const { dataFactory } = this;
            const subject = dataFactory.namedNode('ex://s');
            const graph = dataFactory.namedNode('ex://g');
            const decimal = dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH);
            for (let i = 10; i < 100; i += 1) {
                await this.store.put(dataFactory.quad(subject, dataFactory.namedNode(`ex://p${99 - i}`), dataFactory.literal(`${i}`, decimal), graph));
            }
        });
        it('should produce the same results whether sorting in-memory or not', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({ graph: dataFactory.namedNode('ex://g') }, { order: ['object'] });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeTrue */ .Ak)(memResults.resorted);
            const idxResults = await store.get({ subject: dataFactory.namedNode('ex://s') }, { order: ['object'] });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeFalse */ .kJ)(idxResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToStartWith */ .qD)(idxResults.order, ['object']);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToStartWith */ .qD)(memResults.order, ['object']);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(idxResults.items, 90);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(idxResults.items, memResults.items);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(idxResults.items[0].object.value, '10');
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(idxResults.items[89].object.value, '99');
        });
        it('should produce the same results whether sorting in-memory or not, in reverse', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({ graph: dataFactory.namedNode('ex://g') }, { order: ['object'], reverse: true });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeTrue */ .Ak)(memResults.resorted);
            const idxResults = await store.get({ subject: dataFactory.namedNode('ex://s') }, { order: ['object'], reverse: true });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeFalse */ .kJ)(idxResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToStartWith */ .qD)(idxResults.order, ['object']);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToStartWith */ .qD)(memResults.order, ['object']);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(idxResults.items, 90);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(idxResults.items, memResults.items);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(idxResults.items[0].object.value, '99');
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(idxResults.items[89].object.value, '10');
        });
        it('should order by predicate while querying for a range of object literals, sorting in memory', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({
                object: {
                    termType: 'Range',
                    lt: dataFactory.literal('20', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)),
                },
            }, { order: ['predicate'] });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeTrue */ .Ak)(memResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(memResults.items, 10);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[0].predicate.value, `ex://p80`);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[9].predicate.value, `ex://p89`);
        });
        it('should order by predicate while querying for a range of object literals, sorting in memory, limiting', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({
                object: {
                    termType: 'Range',
                    lt: dataFactory.literal('20', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)),
                },
            }, { order: ['predicate'], limit: 2 });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeTrue */ .Ak)(memResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(memResults.items, 2);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[0].predicate.value, `ex://p80`);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[1].predicate.value, `ex://p81`);
        });
        it('should order by predicate while querying for a range of object literals, sorting in memory, in reverse', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({
                object: {
                    termType: 'Range',
                    lt: dataFactory.literal('20', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)),
                },
            }, { order: ['predicate'], reverse: true });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeTrue */ .Ak)(memResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(memResults.items, 10);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[0].predicate.value, `ex://p89`);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[9].predicate.value, `ex://p80`);
        });
        it('should order by predicate while querying for a range of object literals, sorting in memory, in reverse, limiting', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({
                object: {
                    termType: 'Range',
                    lt: dataFactory.literal('20', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)),
                },
            }, { order: ['predicate'], reverse: true, limit: 2 });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeTrue */ .Ak)(memResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(memResults.items, 2);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[0].predicate.value, `ex://p89`);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[1].predicate.value, `ex://p88`);
        });
        it('should order by object while querying for a range of object literals without sorting in memory', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({
                object: {
                    termType: 'Range',
                    lt: dataFactory.literal('20', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)),
                },
            }, { order: ['object'] });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeFalse */ .kJ)(memResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(memResults.items, 10);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[0].object.value, `10`);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[9].object.value, `19`);
        });
        it('should order by object while querying for a range of object literals without sorting in memory, in reverse', async function () {
            const { dataFactory, store } = this;
            const memResults = await store.get({
                object: {
                    termType: 'Range',
                    lt: dataFactory.literal('20', dataFactory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)),
                },
            }, { order: ['object'], reverse: true });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toBeFalse */ .kJ)(memResults.resorted);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(memResults.items, 10);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[0].object.value, `19`);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .toStrictlyEqual */ .k0)(memResults.items[9].object.value, `10`);
        });
    });
};


/***/ }),

/***/ "../quadstore/import.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "O": () => (/* binding */ runImportTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../utils/expect.js");



const runImportTests = () => {
    describe('Quadstore.prototype.import()', () => {
        it('should import a single quad correctly', async function () {
            const { dataFactory, store } = this;
            const quads = [
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g'))
            ];
            const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
            await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
            const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match());
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(matchedQuads, 1);
        });
        it('should import multiple quads correctly', async function () {
            const { dataFactory, store } = this;
            const quads = [
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s0'), dataFactory.namedNode('http://ex.com/p0'), dataFactory.literal('o0', 'en-gb'), dataFactory.namedNode('http://ex.com/g0')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s1'), dataFactory.namedNode('http://ex.com/p1'), dataFactory.literal('o1', 'en-gb'), dataFactory.namedNode('http://ex.com/g1')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p2'), dataFactory.literal('o2', 'en-gb'), dataFactory.namedNode('http://ex.com/g3'))
            ];
            const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
            await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
            const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match());
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(matchedQuads, 3);
        });
    });
};


/***/ }),

/***/ "../quadstore/match.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "u": () => (/* binding */ runMatchTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../utils/expect.js");



const runMatchTests = () => {
    describe('Quadstore.prototype.match()', () => {
        describe('Match by value', () => {
            it('should match quads by subject', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const subject = dataFactory.namedNode('http://ex.com/s2');
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(subject));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[1]]);
            });
            it('should match quads by predicate', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p2'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const predicate = dataFactory.namedNode('http://ex.com/p2');
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, predicate));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[1]]);
            });
            it('should match quads by object', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g2')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o2', 'en-gb'), dataFactory.namedNode('http://ex.com/g2'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const object = dataFactory.literal('o2', 'en-gb');
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, null, object));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[1]]);
            });
            it('should match quads by graph', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('o', 'en-gb'), dataFactory.namedNode('http://ex.com/g2'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const graph = dataFactory.namedNode('http://ex.com/g2');
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, null, null, graph));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[1]]);
            });
            it('should match the default graph when explicitly passed', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s0'), dataFactory.namedNode('http://ex.com/p0'), dataFactory.literal('o0', 'en-gb'), dataFactory.defaultGraph()),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s1'), dataFactory.namedNode('http://ex.com/p1'), dataFactory.literal('o1', 'en-gb'), dataFactory.namedNode('http://ex.com/g1'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, null, null, dataFactory.defaultGraph()));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[0]]);
            });
        });
        describe('Match by range', () => {
            it('should match quads by object (literal) [GT]', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('5', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')), dataFactory.namedNode('http://ex.com/g')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('7', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')), dataFactory.namedNode('http://ex.com/g'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const match = { termType: 'Range',
                    gt: dataFactory.literal('6', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')) };
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, null, match, null));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[1]]);
            });
            it('should match quads by object (literal) [GTE]', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('5', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')), dataFactory.namedNode('http://ex.com/g')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('7', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')), dataFactory.namedNode('http://ex.com/g'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const match = { termType: 'Range',
                    gte: dataFactory.literal('7.0', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double')) };
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, null, match, null));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .equalsQuadArray */ .EM)(matchedQuads, [quads[1]]);
            });
            it('should not match quads by object (literal) if out of range [GT]', async function () {
                const { dataFactory, store } = this;
                const quads = [
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('5', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')), dataFactory.namedNode('http://ex.com/g')),
                    dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p'), dataFactory.literal('7', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')), dataFactory.namedNode('http://ex.com/g'))
                ];
                const source = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(quads);
                await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(source), 'end', true);
                const match = {
                    termType: 'Range',
                    gt: dataFactory.literal('7.0', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double')),
                };
                const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match(null, null, match, null));
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(matchedQuads, 0);
            });
        });
    });
};


/***/ }),

/***/ "../quadstore/patch.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "J": () => (/* binding */ runPatchTests)
/* harmony export */ });
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../utils/expect.js");

const runPatchTests = () => {
    describe('Quadstore.prototype.patch()', async function () {
        it('should delete old quads and add new ones', async function () {
            const { dataFactory, store } = this;
            const quadsArray = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
            const oldQuads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
            const newQuads = [
                dataFactory.quad(dataFactory.namedNode('ex://s3'), dataFactory.namedNode('ex://p3'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s4'), dataFactory.namedNode('ex://p3'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g')),
            ];
            const expected = quadsArray.slice(2).concat(newQuads);
            await store.multiPut(quadsArray);
            await store.multiPatch(oldQuads, newQuads);
            const { items: quads } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .equalsQuadArray */ .EM)(quads, expected);
        });
    });
};


/***/ }),

/***/ "../quadstore/prewrite.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "W": () => (/* binding */ runPrewriteTests)
/* harmony export */ });
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../utils/expect.js");

const encoder = new TextEncoder();
const runPrewriteTests = () => {
    describe('Quadstore preWrite option', () => {
        let quads;
        const prewriteValue = encoder.encode('value1');
        beforeEach(function () {
            const { dataFactory } = this;
            quads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
        });
        it('should pre-write kvps when putting a quad', async function () {
            const { store } = this;
            await store.put(quads[0], {
                preWrite: (batch) => batch.put('key1', prewriteValue)
            });
            const value = await store.db.get('key1', { valueEncoding: 'view' });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toEqualUint8Array */ .$$)(prewriteValue, value);
        });
        it('should pre-write kvps when putting quads', async function () {
            const { store } = this;
            await store.multiPut(quads, {
                preWrite: (batch) => batch.put('key1', prewriteValue)
            });
            const value = await store.db.get('key1', { valueEncoding: 'view' });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toEqualUint8Array */ .$$)(prewriteValue, value);
        });
        it('should pre-write kvps when deleting a quad', async function () {
            const { store } = this;
            await store.put(quads[0]);
            await store.del(quads[0], {
                preWrite: (batch) => batch.put('key1', prewriteValue)
            });
            const value = await store.db.get('key1', { valueEncoding: 'view' });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toEqualUint8Array */ .$$)(prewriteValue, value);
        });
        it('should pre-write kvps when deleting quads', async function () {
            const { store } = this;
            await store.multiPut(quads);
            await store.multiDel(quads, {
                preWrite: (batch) => batch.put('key1', prewriteValue)
            });
            const value = await store.db.get('key1', { valueEncoding: 'view' });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toEqualUint8Array */ .$$)(prewriteValue, value);
        });
        it('should pre-write kvps when patching a quad', async function () {
            const { store } = this;
            await store.put(quads[0]);
            await store.patch(quads[0], quads[1], {
                preWrite: (batch) => batch.put('key1', prewriteValue)
            });
            const value = await store.db.get('key1', { valueEncoding: 'view' });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toEqualUint8Array */ .$$)(prewriteValue, value);
        });
        it('should pre-write kvps when patching quads', async function () {
            const { store } = this;
            await store.multiPut([quads[0]]);
            await store.multiPatch([quads[0]], [quads[1]], {
                preWrite: (batch) => batch.put('key1', prewriteValue)
            });
            const value = await store.db.get('key1', { valueEncoding: 'view' });
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_0__/* .toEqualUint8Array */ .$$)(prewriteValue, value);
        });
    });
};


/***/ }),

/***/ "../quadstore/put.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "D": () => (/* binding */ runPutTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/scope/index.js");
/* harmony import */ var _dist_esm_get_leveliterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/get/leveliterator.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../utils/expect.js");





const runPutTests = () => {
    describe('Quadstore.prototype.put()', () => {
        it('should store a single quad', async function () {
            const { dataFactory, store } = this;
            const newQuad = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g'));
            await store.put(newQuad);
            const { items: foundQuads } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .equalsQuadArray */ .EM)(foundQuads, [newQuad]);
        });
        it('should store a single quad with a term that serializes to a string longer than 127 chars', async function () {
            const { dataFactory, store } = this;
            const newQuad = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.literal(''.padStart(2000, 'aaabbb')), dataFactory.namedNode('ex://g'));
            await store.put(newQuad);
            const { items: foundQuads } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .equalsQuadArray */ .EM)(foundQuads, [newQuad]);
        });
        it('should store multiple quads', async function () {
            const { dataFactory, store } = this;
            const newQuads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
            await store.put(newQuads[0]);
            await store.put(newQuads[1]);
            const { items: foundQuads } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .equalsQuadArray */ .EM)(foundQuads, newQuads);
        });
        it('should not duplicate quads', async function () {
            const { dataFactory, store } = this;
            const newQuads = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode('ex://o'), dataFactory.namedNode('ex://g')),
                dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.namedNode('ex://o2'), dataFactory.namedNode('ex://g2')),
            ];
            await store.put(newQuads[0]);
            await store.put(newQuads[1]);
            await store.put(newQuads[1]);
            const { items: foundQuads } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .equalsQuadArray */ .EM)(foundQuads, newQuads);
        });
    });
    describe('Quadstore.prototype.put() with scope', () => {
        it('Should transform blank node labels', async function () {
            const { dataFactory, store } = this;
            const scope = await store.initScope();
            const quadA = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g'));
            await store.put(quadA, { scope });
            const { items: [quadB] } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadB.subject.equals(quadA.subject));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadB.predicate.equals(quadA.predicate));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeFalse */ .kJ)(quadB.object.equals(quadA.object));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadB.graph.equals(quadA.graph));
        });
        it('Should maintain mappings across different invocations', async function () {
            const { dataFactory, store } = this;
            const scope = await store.initScope();
            const quadA = dataFactory.quad(dataFactory.namedNode('ex://s1'), dataFactory.namedNode('ex://p1'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g1'));
            const quadB = dataFactory.quad(dataFactory.namedNode('ex://s2'), dataFactory.namedNode('ex://p2'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g2'));
            await store.put(quadA, { scope });
            await store.put(quadB, { scope });
            const { items } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(items, 2);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(items[1].object.equals(items[0].object));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeFalse */ .kJ)(items[1].object.equals(quadA.object));
        });
        it('Should persist scope mappings', async function () {
            const { dataFactory, store } = this;
            const scope = await store.initScope();
            const quad = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g'));
            await store.put(quad, { scope });
            const levelOpts = _dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__/* .Scope.getLevelIteratorOpts */ .s.getLevelIteratorOpts(true, true, scope.id);
            const entries = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(new _dist_esm_get_leveliterator_js__WEBPACK_IMPORTED_MODULE_3__/* .LevelIterator */ .g(store.db.iterator(levelOpts), (key, value) => value));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeAnArray */ .Th)(entries);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(entries, 1);
            const { originalLabel, randomLabel } = JSON.parse(entries[0]);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toStrictlyEqual */ .k0)(originalLabel, 'bo');
        });
    });
    describe('Quadstore.prototype.multiPut() with scope', () => {
        it('Should transform blank node labels', async function () {
            const { dataFactory, store } = this;
            const scope = await store.initScope();
            const quadsA = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g')),
            ];
            await store.multiPut(quadsA, { scope });
            const { items: quadsB } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(quadsB, 1);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadsB[0].subject.equals(quadsA[0].subject));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadsB[0].predicate.equals(quadsA[0].predicate));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeFalse */ .kJ)(quadsB[0].object.equals(quadsA[0].object));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadsB[0].graph.equals(quadsA[0].graph));
        });
    });
    describe('Quadstore.prototype.putStream() with scope', () => {
        it('Should transform blank node labels', async function () {
            const { dataFactory, store } = this;
            const scope = await store.initScope();
            const quadsA = [
                dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g')),
            ];
            await store.putStream(new asynciterator__WEBPACK_IMPORTED_MODULE_4__/* .ArrayIterator */ .m(quadsA), { scope });
            const { items: quadsB } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(quadsB, 1);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadsB[0].subject.equals(quadsA[0].subject));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadsB[0].predicate.equals(quadsA[0].predicate));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeFalse */ .kJ)(quadsB[0].object.equals(quadsA[0].object));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeTrue */ .Ak)(quadsB[0].graph.equals(quadsA[0].graph));
        });
    });
    describe('Quadstore.prototype.putStream() with batchSize', () => {
        beforeEach(async function () {
            const { dataFactory } = this;
            const quads = [];
            for (let i = 0; i < 10; i += 1) {
                quads.push(dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.namedNode(`ex://o${i}`), dataFactory.namedNode('ex://g')));
            }
            this.quads = quads;
        });
        afterEach(async function () {
            const { store, quads } = this;
            const { items } = await store.get({});
            items.sort((a, b) => a.object.value < b.object.value ? -1 : 1);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .equalsQuadArray */ .EM)(items, quads);
        });
        it('batchSize set to 1', async function () {
            const { store, quads } = this;
            await store.putStream(new asynciterator__WEBPACK_IMPORTED_MODULE_4__/* .ArrayIterator */ .m(quads), { batchSize: 1 });
        });
        it('batchSize set to the number of quads', async function () {
            const { store, quads } = this;
            await store.putStream(new asynciterator__WEBPACK_IMPORTED_MODULE_4__/* .ArrayIterator */ .m(quads), { batchSize: 10 });
        });
        it('batchSize set to a perfect divisor of the number of quads', async function () {
            const { store, quads } = this;
            await store.putStream(new asynciterator__WEBPACK_IMPORTED_MODULE_4__/* .ArrayIterator */ .m(quads), { batchSize: 2 });
        });
        it('batchSize set to an imperfect divisor of the number of quads', async function () {
            const { store, quads } = this;
            await store.putStream(new asynciterator__WEBPACK_IMPORTED_MODULE_4__/* .ArrayIterator */ .m(quads), { batchSize: 3 });
        });
    });
};


/***/ }),

/***/ "../quadstore/quadstore.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "o": () => (/* binding */ runQuadstoreTests)
/* harmony export */ });
/* harmony import */ var _dist_esm_quadstore_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/quadstore.js");
/* harmony import */ var _serialization_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../quadstore/serialization.js");
/* harmony import */ var _prewrite_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../quadstore/prewrite.js");
/* harmony import */ var _get_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../quadstore/get.js");
/* harmony import */ var _del_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__("../quadstore/del.js");
/* harmony import */ var _remove_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__("../quadstore/remove.js");
/* harmony import */ var _import_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__("../quadstore/import.js");
/* harmony import */ var _removematches_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__("../quadstore/removematches.js");
/* harmony import */ var _patch_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__("../quadstore/patch.js");
/* harmony import */ var _match_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__("../quadstore/match.js");
/* harmony import */ var _scope_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__("../quadstore/scope.js");
/* harmony import */ var _put_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__("../quadstore/put.js");












const runTests = () => {
    (0,_get_js__WEBPACK_IMPORTED_MODULE_3__/* .runGetTests */ .h)();
    (0,_del_js__WEBPACK_IMPORTED_MODULE_4__/* .runDelTests */ .N)();
    (0,_put_js__WEBPACK_IMPORTED_MODULE_11__/* .runPutTests */ .D)();
    (0,_scope_js__WEBPACK_IMPORTED_MODULE_10__/* .runScopeTests */ .F)();
    (0,_patch_js__WEBPACK_IMPORTED_MODULE_8__/* .runPatchTests */ .J)();
    (0,_match_js__WEBPACK_IMPORTED_MODULE_9__/* .runMatchTests */ .u)();
    (0,_import_js__WEBPACK_IMPORTED_MODULE_6__/* .runImportTests */ .O)();
    (0,_remove_js__WEBPACK_IMPORTED_MODULE_5__/* .runRemoveTests */ .a)();
    (0,_removematches_js__WEBPACK_IMPORTED_MODULE_7__/* .runRemoveMatchesTests */ .R)();
    (0,_prewrite_js__WEBPACK_IMPORTED_MODULE_2__/* .runPrewriteTests */ .W)();
    (0,_serialization_js__WEBPACK_IMPORTED_MODULE_1__/* .runSerializationTests */ .d)();
    // require('./quadstore.prototype.put')();
    // require('./quadstore.scope')();
};
const runQuadstoreTests = () => {
    describe('Constructor', () => {
        it('should throw if backend is not an instance of AbstractLevel', function (done) {
            try {
                new _dist_esm_quadstore_js__WEBPACK_IMPORTED_MODULE_0__/* .Quadstore */ .T({
                    dataFactory: this.dataFactory,
                    backend: 5,
                });
            }
            catch (err) {
                done();
            }
        });
    });
    describe('Quadstore', () => {
        beforeEach(async function () {
            this.store = new _dist_esm_quadstore_js__WEBPACK_IMPORTED_MODULE_0__/* .Quadstore */ .T({
                dataFactory: this.dataFactory,
                backend: this.db,
                indexes: this.indexes,
                prefixes: this.prefixes,
            });
            await this.store.open();
        });
        afterEach(async function () {
            await this.store.close();
        });
        runTests();
    });
    describe('Quadstore, with prefixes', () => {
        const prefixes = {
            expandTerm: (term) => {
                if (term.startsWith('xsd:')) {
                    return `http://www.w3.org/2001/XMLSchema#${term.slice(4)}`;
                }
                if (term.startsWith('rdf:')) {
                    return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${term.slice(4)}`;
                }
                if (term.startsWith('e:')) {
                    return `ex://${term.slice(2)}`;
                }
                return term;
            },
            compactIri: (iri) => {
                if (iri.startsWith('http://www.w3.org/2001/XMLSchema#')) {
                    return `xsd:${iri.slice(33)}`;
                }
                if (iri.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#')) {
                    return `rdf:${iri.slice(43)}`;
                }
                if (iri.startsWith('ex://')) {
                    return `e:${iri.slice(5)}`;
                }
                return iri;
            },
        };
        beforeEach(async function () {
            this.store = new _dist_esm_quadstore_js__WEBPACK_IMPORTED_MODULE_0__/* .Quadstore */ .T({
                dataFactory: this.dataFactory,
                backend: this.db,
                indexes: this.indexes,
                prefixes: this.prefixes,
            });
            await this.store.open();
        });
        afterEach(async function () {
            await this.store.close();
        });
        runTests();
    });
};


/***/ }),

/***/ "../quadstore/remove.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "a": () => (/* binding */ runRemoveTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../utils/expect.js");



const runRemoveTests = () => {
    describe('Quadstore.prototype.remove()', () => {
        it('should remove streamed quads correctly', async function () {
            const { dataFactory, store } = this;
            const importQuads = [
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s0'), dataFactory.namedNode('http://ex.com/p0'), dataFactory.literal('o0', 'en-gb'), dataFactory.namedNode('http://ex.com/g0')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s1'), dataFactory.namedNode('http://ex.com/p1'), dataFactory.literal('o1', 'en-gb'), dataFactory.namedNode('http://ex.com/g1')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p2'), dataFactory.literal('o2', 'en-gb'), dataFactory.namedNode('http://ex.com/g3'))
            ];
            const removeQuads = [
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s1'), dataFactory.namedNode('http://ex.com/p1'), dataFactory.literal('o1', 'en-gb'), dataFactory.namedNode('http://ex.com/g1')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p2'), dataFactory.literal('o2', 'en-gb'), dataFactory.namedNode('http://ex.com/g3'))
            ];
            const importStream = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(importQuads);
            const removeStream = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(removeQuads);
            await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(importStream), 'end', true);
            await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.remove(removeStream), 'end', true);
            const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match());
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(matchedQuads, 1);
        });
    });
};


/***/ }),

/***/ "../quadstore/removematches.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "R": () => (/* binding */ runRemoveMatchesTests)
/* harmony export */ });
/* harmony import */ var asynciterator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../node_modules/asynciterator/dist/asynciterator.js");
/* harmony import */ var _dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../utils/expect.js");



const runRemoveMatchesTests = () => {
    describe('Quadstore.prototype.removeMatches()', () => {
        it('should remove matching quads correctly', async function () {
            const { dataFactory, store } = this;
            const importQuads = [
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s0'), dataFactory.namedNode('http://ex.com/p0'), dataFactory.literal('o0', 'en-gb'), dataFactory.namedNode('http://ex.com/g0')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s1'), dataFactory.namedNode('http://ex.com/p1'), dataFactory.literal('o1', 'en-gb'), dataFactory.namedNode('http://ex.com/g1')),
                dataFactory.quad(dataFactory.namedNode('http://ex.com/s2'), dataFactory.namedNode('http://ex.com/p2'), dataFactory.literal('o2', 'en-gb'), dataFactory.namedNode('http://ex.com/g1'))
            ];
            const importStream = new asynciterator__WEBPACK_IMPORTED_MODULE_2__/* .ArrayIterator */ .m(importQuads);
            await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.import(importStream), 'end', true);
            await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .waitForEvent */ .mA)(store.removeMatches(null, null, null, dataFactory.namedNode('http://ex.com/g1')), 'end', true);
            const matchedQuads = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(store.match());
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_1__/* .arrayToHaveLength */ .A_)(matchedQuads, 1);
        });
    });
};


/***/ }),

/***/ "../quadstore/scope.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "F": () => (/* binding */ runScopeTests)
/* harmony export */ });
/* harmony import */ var _dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/utils/stuff.js");
/* harmony import */ var _dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/scope/index.js");
/* harmony import */ var _dist_esm_get_leveliterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../../dist/esm/get/leveliterator.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../utils/expect.js");




const runScopeTests = () => {
    describe('Quadstore.prototype.initScope()', () => {
        it('Should return a newly-instantiated scope', async function () {
            const { store } = this;
            const scope = await store.initScope();
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeInstanceOf */ .jx)(scope, _dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__/* .Scope */ .s);
        });
    });
    describe('Quadstore.prototype.loadScope()', () => {
        it('Should return a newly-instantiated scope', async function () {
            const { store } = this;
            const scope = await store.loadScope('random-id');
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeInstanceOf */ .jx)(scope, _dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__/* .Scope */ .s);
        });
        it('Should not leak mappings between different scopes', async function () {
            const { dataFactory, store } = this;
            const scopeA = await store.initScope();
            const scopeB = await store.initScope();
            const quad = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g'));
            await store.put(quad, { scope: scopeA });
            await store.put(quad, { scope: scopeB });
            const { items } = await store.get({});
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(items, 2);
            const reloadedScopeA = await store.loadScope(scopeA.id);
            const reloadedScopeB = await store.loadScope(scopeB.id);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toNotEqualTerm */ .SU)(reloadedScopeA.blankNodes.get('bo'), reloadedScopeB.blankNodes.get('bo'));
        });
    });
    describe('Quadstore.prototype.deleteScope()', () => {
        it('Should delete the mappings of a given scope', async function () {
            const { dataFactory, store } = this;
            const scopeA = await store.initScope();
            const scopeB = await store.initScope();
            const quad = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g'));
            await store.put(quad, { scope: scopeA });
            await store.put(quad, { scope: scopeB });
            await store.deleteScope(scopeA.id);
            const entriesA = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(new _dist_esm_get_leveliterator_js__WEBPACK_IMPORTED_MODULE_3__/* .LevelIterator */ .g(store.db.iterator(_dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__/* .Scope.getLevelIteratorOpts */ .s.getLevelIteratorOpts(true, true, scopeA.id)), (key, value) => value));
            const entriesB = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(new _dist_esm_get_leveliterator_js__WEBPACK_IMPORTED_MODULE_3__/* .LevelIterator */ .g(store.db.iterator(_dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__/* .Scope.getLevelIteratorOpts */ .s.getLevelIteratorOpts(true, true, scopeB.id)), (key, value) => value));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeAnArray */ .Th)(entriesA);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeAnArray */ .Th)(entriesB);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(entriesA, 0);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(entriesB, 1);
        });
    });
    describe('Quadstore.prototype.deleteAllScopes()', () => {
        it('Should delete all scope mappings', async function () {
            const { dataFactory, store } = this;
            const scopeA = await store.initScope();
            const scopeB = await store.initScope();
            const quad = dataFactory.quad(dataFactory.namedNode('ex://s'), dataFactory.namedNode('ex://p'), dataFactory.blankNode('bo'), dataFactory.namedNode('ex://g'));
            await store.put(quad, { scope: scopeA });
            await store.put(quad, { scope: scopeB });
            await store.deleteAllScopes();
            const entries = await (0,_dist_esm_utils_stuff_js__WEBPACK_IMPORTED_MODULE_0__/* .streamToArray */ .an)(new _dist_esm_get_leveliterator_js__WEBPACK_IMPORTED_MODULE_3__/* .LevelIterator */ .g(store.db.iterator(_dist_esm_scope_index_js__WEBPACK_IMPORTED_MODULE_1__/* .Scope.getLevelIteratorOpts */ .s.getLevelIteratorOpts(true, true)), (key, value) => value));
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toBeAnArray */ .Th)(entries);
            (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .arrayToHaveLength */ .A_)(entries, 0);
        });
    });
};


/***/ }),

/***/ "../quadstore/serialization.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "d": () => (/* binding */ runSerializationTests)
/* harmony export */ });
/* harmony import */ var _dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../dist/esm/serialization/xsd.js");
/* harmony import */ var _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/serialization/index.js");
/* harmony import */ var _utils_expect_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../utils/expect.js");



const runSerializationTests = () => {
    describe('Quadstore serialization', function () {
        const value = new Uint16Array(32);
        it('Should serialize and deserialize quads with named nodes', function () {
            const { store } = this;
            const { indexes, prefixes, dataFactory: factory } = store;
            const quad = factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.namedNode('http://ex.com/o'), factory.namedNode('http://ex.com/g'));
            indexes.forEach((index) => {
                const key = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadWriter.write */ .LT.write(index.prefix, value, 0, quad, index.terms, prefixes);
                const read = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadReader.read */ .E9.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toEqualQuad */ .Hq)(read, quad);
            });
        });
        it('Should serialize and deserialize quads in the default graph', function () {
            const { store } = this;
            const { indexes, prefixes, dataFactory: factory } = store;
            const quad = factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.namedNode('http://ex.com/o'), factory.defaultGraph());
            indexes.forEach((index) => {
                const key = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadWriter.write */ .LT.write(index.prefix, value, 0, quad, index.terms, prefixes);
                const read = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadReader.read */ .E9.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toEqualQuad */ .Hq)(read, quad);
            });
        });
        it('Should serialize and deserialize quads with generic literals', function () {
            const { store } = this;
            const { indexes, prefixes, dataFactory: factory } = store;
            const quad = factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.literal('someValue', factory.namedNode('http://ex.com/someDatatype')), factory.namedNode('http://ex.com/g'));
            indexes.forEach((index) => {
                const key = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadWriter.write */ .LT.write(index.prefix, value, 0, quad, index.terms, prefixes);
                const read = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadReader.read */ .E9.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toEqualQuad */ .Hq)(read, quad);
            });
        });
        it('Should serialize and deserialize quads with named nodes and language-tagged literals', function () {
            const { store } = this;
            const { indexes, prefixes, dataFactory: factory } = store;
            const quad = factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.literal('Hello, world!', 'en'), factory.namedNode('http://ex.com/g'));
            indexes.forEach((index) => {
                const key = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadWriter.write */ .LT.write(index.prefix, value, 0, quad, index.terms, prefixes);
                const read = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadReader.read */ .E9.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toEqualQuad */ .Hq)(read, quad);
            });
        });
        it('Should serialize and deserialize quads with named nodes and numeric literals', function () {
            const { store } = this;
            const { indexes, prefixes, dataFactory: factory } = store;
            const quad = factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.literal('44', factory.namedNode(_dist_esm_serialization_xsd_js__WEBPACK_IMPORTED_MODULE_0__/* .decimal */ .gH)), factory.namedNode('http://ex.com/g'));
            indexes.forEach((index) => {
                const key = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadWriter.write */ .LT.write(index.prefix, value, 0, quad, index.terms, prefixes);
                const read = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadReader.read */ .E9.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toEqualQuad */ .Hq)(read, quad);
            });
        });
        it('Should serialize and deserialize a quad having a literal term that serializes to a string longer than 127 chars', async function () {
            const { store: { dataFactory: factory, indexes }, prefixes } = this;
            const quad = factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.literal(''.padStart(2000, 'abab')), factory.namedNode('http://ex.com/g'));
            indexes.forEach((index) => {
                const key = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadWriter.write */ .LT.write(index.prefix, value, 0, quad, index.terms, prefixes);
                const read = _dist_esm_serialization_index_js__WEBPACK_IMPORTED_MODULE_1__/* .quadReader.read */ .E9.read(key, index.prefix.length, value, 0, index.terms, factory, prefixes);
                (0,_utils_expect_js__WEBPACK_IMPORTED_MODULE_2__/* .toEqualQuad */ .Hq)(read, quad);
            });
        });
    });
};


/***/ }),

/***/ "../utils/expect.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "$$": () => (/* binding */ toEqualUint8Array),
/* harmony export */   "A_": () => (/* binding */ arrayToHaveLength),
/* harmony export */   "Ak": () => (/* binding */ toBeTrue),
/* harmony export */   "EM": () => (/* binding */ equalsQuadArray),
/* harmony export */   "Hq": () => (/* binding */ toEqualQuad),
/* harmony export */   "PI": () => (/* binding */ toBeLessThanOrEqualTo),
/* harmony export */   "SU": () => (/* binding */ toNotEqualTerm),
/* harmony export */   "Th": () => (/* binding */ toBeAnArray),
/* harmony export */   "jx": () => (/* binding */ toBeInstanceOf),
/* harmony export */   "k0": () => (/* binding */ toStrictlyEqual),
/* harmony export */   "kJ": () => (/* binding */ toBeFalse),
/* harmony export */   "qD": () => (/* binding */ arrayToStartWith)
/* harmony export */ });
/* unused harmony exports toBeAnObject, toBeAString, toBeATerm, toBeAQuad, toBeAFiniteNumber, toBeAQuadArray, toEqualTerm */
/* harmony import */ var chai__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/chai/index.mjs");
/* harmony import */ var _dist_esm_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../dist/esm/utils/constants.js");


const toBeTrue = (value) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.true;
};
const toBeFalse = (value) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.false;
};
const toBeAnArray = (value, length) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.an('array');
    if (typeof length === 'number') {
        (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.have.length(length);
    }
};
const toBeAnObject = (value) => {
    expect(value).to.be.an('object');
};
const toBeAString = (value) => {
    expect(value).to.be.a('string');
};
const toBeATerm = (value) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.an('object');
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.have.property('termType');
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value.termType).to.be.a('string');
};
const toBeAQuad = (value) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.an('object');
    _dist_esm_utils_constants_js__WEBPACK_IMPORTED_MODULE_1__/* .termNames.forEach */ .Od.forEach((termName) => {
        (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.have.property(termName);
        toBeATerm(value[termName]);
    });
};
const toBeAFiniteNumber = (value) => {
    expect(value).to.be.a('number');
    expect(value).not.to.be.NaN;
    expect(value).not.to.equal(Infinity);
    expect(value).not.to.equal(-Infinity);
};
const toBeLessThanOrEqualTo = (value, compare) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).not.to.be.greaterThan(compare);
};
const toStrictlyEqual = (value, compare) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.equal(compare);
};
const toBeAQuadArray = (value, length) => {
    expect(value).to.be.an('array');
    if (typeof length === 'number') {
        expect(value).to.have.length(length);
    }
    for (let i = 0, l = value.length; i < l; i += 1) {
        toBeAQuad(value[i]);
    }
};
const toEqualTerm = (value, expected) => {
    toBeATerm(value);
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value.termType).to.equal(expected.termType);
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value.value).to.equal(expected.value);
    if (expected.termType === 'Literal') {
        (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value.language).to.equal(expected.language);
        if (expected.datatype) {
            toEqualTerm(value.datatype, expected.datatype);
        }
    }
};
const toNotEqualTerm = (value, expected) => {
    toBeATerm(value);
    if (value.termType !== expected.termType) {
        return;
    }
    if (value.value !== expected.value) {
        return;
    }
    if (expected.termType === 'Literal') {
        if (expected.language && value.language !== expected.language) {
            return;
        }
        if (expected.datatype) {
            return toNotEqualTerm(value.datatype, expected.datatype);
        }
    }
    throw new Error(`expected ${value} not to be equal to ${expected}`);
};
const toEqualQuad = (value, expected) => {
    toBeAQuad(value);
    toEqualTerm(value.subject, expected.subject);
    toEqualTerm(value.predicate, expected.predicate);
    toEqualTerm(value.object, expected.object);
    toEqualTerm(value.graph, expected.graph);
};
const equalsQuadArray = (value, expected) => {
    toBeAnArray(value);
    toStrictlyEqual(value.length, expected.length);
    for (let i = 0, l = expected.length; i < l; i += 1) {
        toEqualQuad(value[i], expected[i]);
    }
};
const arrayToStartWith = (arr, start) => {
    for (let i = 0, l = start.length; i < l; i += 1) {
        (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(arr[i]).to.equal(start[i]);
    }
};
const arrayToHaveLength = (arr, length) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(arr).to.have.length(length);
};
const toBeInstanceOf = (value, clss) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.instanceOf(clss);
};
const toEqualUint8Array = (value, expected) => {
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.be.an('Uint8Array');
    (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value).to.have.length(expected.length);
    for (let i = 0, l = expected.length; i < l; i += 1) {
        (0,chai__WEBPACK_IMPORTED_MODULE_0__/* .expect */ .l_)(value[i]).to.equal(expected[i]);
    }
};


/***/ }),

/***/ "../utils/stuff.js":
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BY": () => (/* binding */ delayIterator)
/* harmony export */ });
/* unused harmony exports iteratorToArray, equalsUint8Array */
const iteratorToArray = (iterator) => {
    return new Promise((resolve, reject) => {
        const arr = [];
        iterator.on('data', (item) => {
            arr.push(item);
        });
        iterator.on('end', () => {
            resolve(arr);
        });
    });
};
const delayIterator = (iterator, maxDelay = 5) => {
    return iterator.transform({ transform: (item, done, push) => {
            setTimeout(() => {
                push(item);
                done();
            }, Math.round(Math.random() * maxDelay));
        } });
};
const equalsUint8Array = (a, b) => {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};


/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __webpack_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/create fake namespace object */
/******/ (() => {
/******/ 	var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 	var leafPrototypes;
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 16: return value when it's Promise-like
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = this(value);
/******/ 		if(mode & 8) return value;
/******/ 		if(typeof value === 'object' && value) {
/******/ 			if((mode & 4) && value.__esModule) return value;
/******/ 			if((mode & 16) && typeof value.then === 'function') return value;
/******/ 		}
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		var def = {};
/******/ 		leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 		for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 			Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 		}
/******/ 		def['default'] = () => (value);
/******/ 		__webpack_require__.d(ns, def);
/******/ 		return ns;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/global */
/******/ (() => {
/******/ 	__webpack_require__.g = (function() {
/******/ 		if (typeof globalThis === 'object') return globalThis;
/******/ 		try {
/******/ 			return this || new Function('return this')();
/******/ 		} catch (e) {
/******/ 			if (typeof window === 'object') return window;
/******/ 		}
/******/ 	})();
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/make namespace object */
/******/ (() => {
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/* harmony import */ var _backends_memorylevel_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../backends/memorylevel.js");
/* harmony import */ var _backends_browserlevel_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../backends/browserlevel.js");
/* harmony import */ var _others_others_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../others/others.js");



(0,_others_others_js__WEBPACK_IMPORTED_MODULE_2__/* .runOtherTests */ .R)();
(0,_backends_memorylevel_js__WEBPACK_IMPORTED_MODULE_0__/* .runMemoryLevelTests */ .D)();
(0,_backends_browserlevel_js__WEBPACK_IMPORTED_MODULE_1__/* .runBrowserLevelTests */ .O)();

})();

