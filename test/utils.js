
'use strict';

const n3 = require('n3');
const url = require('url');
const http = require('http');

async function serializeQuads(quads, format) {
  return new Promise((resolve, reject) => {
    const writer = n3.Writer({ format });
    writer.addQuads(quads);
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

module.exports.serializeQuads = serializeQuads;

async function deserializeQuads(data, format) {
  return new Promise((resolve, reject) => {
    const parser = n3.Parser({ format });
    const quads = [];
    parser.parse(data, (err, quad) => {
      if (err) reject(err);
      else if (!quad) resolve(quads);
      else quads.push(quad);
    });
  });
}

module.exports.deserializeQuads = deserializeQuads;

async function get(targetUrl, acceptedFormat) {
  return new Promise((resolve, reject) => {
    const opts = typeof(targetUrl) === 'string'
      ? url.parse(targetUrl)
      : targetUrl;
    if (acceptedFormat) {
      if (!opts.headers) {
        opts.headers = {};
      }
      opts.headers.accept = acceptedFormat;
    }
    http.get(targetUrl, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Bad status code (${res.statusCode}).`));
        return;
      }
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => { resolve([buf, res.headers['content-type']]); });
    });
  });
}

module.exports.get = get;

async function getQuads(targetUrl) {
  const [payload, format] = await get(targetUrl);
  return deserializeQuads(payload, format);
}

module.exports.getQuads = getQuads;

async function postQuads(targetUrl, quads, format) {
  if (!format) format = 'application/trig';
  const payload = await serializeQuads(quads, format);
  return new Promise((resolve, reject) => {
    const opts = url.parse(targetUrl);
    opts.headers = { 'Content-Type': format };
    opts.method = 'POST';
    const req = http.request(opts, (res) => {
      res.resume();
      if (res.statusCode !== 200) {
        reject(new Error('Bad status code.'));
        return;
      }
      res.on('error', (err) => { reject(err); });
      res.on('end', () => { resolve(); });
    });
    req.on('error', (err) => { reject(err); });
    req.write(payload);
    req.end();
  });
}

module.exports.postQuads = postQuads;

const iteratorToArray = (iterator, cb) => {
  const arr = [];
  iterator.on('data', (item) => {
    arr.push(item);
  });
  iterator.on('end', () => {
    cb(null, arr);
  });
};

module.exports.iteratorToArray = iteratorToArray;

const delayIterator = (iterator, avgDelay = 5) => {
  const delayed = iterator.transform(function (item, done) {
    setTimeout(() => {
      this._push(item);
      done();
    }, Math.round(Math.random() * avgDelay));
  });
  return delayed;
};

module.exports.delayIterator = delayIterator;
