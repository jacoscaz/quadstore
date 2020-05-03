
const AsyncIterator = require('asynciterator');
let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../../quadstore');
});

class BindingsIterator extends AsyncIterator.TransformIterator {

  constructor(store, matchTerms, termToVariableMappings) {
    super();
    const source = QuadStore.prototype.getStream.call(store, matchTerms);
    source.getProperty('sorting', (terms) => {

      let lastHash = null;

      const getHash = (quad) => {
        let hash = '';
        for (let term of terms) {
          if (termToVariableMappings[term]) {
            hash += quad[term];
          }
        }
        return hash;
      };

      this._transform = (quad, done) => {
        const hash = getHash(quad);
        if (lastHash !== hash) {
          const binding = {};
          for (const term in termToVariableMappings) {
            if (termToVariableMappings.hasOwnProperty(term)) {
              binding[termToVariableMappings[term]] = quad[term];
            }
          }
          this._push(binding);
          lastHash = hash;
        }
        done();
      };

      this.source = source;
    });
  }

}

module.exports = BindingsIterator;
