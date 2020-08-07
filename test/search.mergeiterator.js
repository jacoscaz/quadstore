const AsyncIterator = require('asynciterator');
const MergeIterator = require('../dist/cjs/lib/search/iterators/merge-iterator').default;
const should = require('should');
const utils = require('./utils');


module.exports = () => {

  describe('MergeIterator', () => {

    it('should merge correctly with same range, different stepping', (cb) => {
      const a = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 9, step: 1 }));
      const b = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 9, step: 2 }));
      const p = (a, b) => a;
      const c = (a, b) => a < b ? -1 : ( a === b ? 0 : 1);
      const m = new MergeIterator(a, b, c, p);
      let latest = null;
      m.on('data', (n) => {
        if (latest === null) {
          should(n).equal(0);
          latest = n;
          return;
        }
        should(n).equal(latest + 2);
        latest = n;
      });
      m.on('end', () => {
        should(latest).equal(8);
        should(a.done).equal(true);
        should(b.done).equal(true);
        cb();
      });
    });

    it('should merge correctly with same range, different stepping (inverted)', (cb) => {
      const a = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 9, step: 2 }));
      const b = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 9, step: 1 }));
      const p = (a, b) => a;
      const c = (a, b) => a < b ? -1 : ( a === b ? 0 : 1);
      const m = new MergeIterator(a, b, c, p);
      let latest = null;
      m.on('data', (n) => {
        if (latest === null) {
          should(n).equal(0);
          latest = n;
          return;
        }
        should(n).equal(latest + 2);
        latest = n;
      });
      m.on('end', () => {
        should(latest).equal(8);
        should(a.done).equal(true);
        should(b.done).equal(true);
        cb();
      });
    });

    it('should merge correctly with different range, different stepping', (cb) => {
      const a = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 10, end: 19, step: 2 }));
      const b = utils.delayIterator(new AsyncIterator.IntegerIterator({ start: 0, end: 29, step: 1 }));
      const p = (a, b) => a;
      const c = (a, b) => a < b ? -1 : ( a === b ? 0 : 1);
      const m = new MergeIterator(a, b, c, p);
      let latest = null;
      m.on('data', (n) => {
        if (latest === null) {
          should(n).equal(10);
          latest = n;
          return;
        }
        should(n).equal(latest + 2);
        latest = n;
      });
      m.on('end', () => {
        should(latest).equal(18);
        should(a.done).equal(true);
        should(b.done).equal(true);
        cb();
      });
    });

    it('should merge correctly with different extended range, different stepping', function (cb) {
      this.timeout(0);
      const a = new AsyncIterator.IntegerIterator({ start: 1000, end: 1999, step: 2 });
      const b = new AsyncIterator.IntegerIterator({ start: 0, end: 3000, step: 1 });
      const p = (a, b) => a;
      const c = (a, b) => a < b ? -1 : ( a === b ? 0 : 1);
      const m = new MergeIterator(a, b, c, p);
      let latest = null;
      m.on('data', (n) => {
        if (latest === null) {
          should(n).equal(1000);
          latest = n;
          return;
        }
        should(n).equal(latest + 2);
        latest = n;
      });
      m.on('end', () => {
        should(latest).equal(1998);
        should(a.done).equal(true);
        should(b.done).equal(true);
        cb();
      });
    });

  });

};
