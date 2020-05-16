
const AsyncIterator = require('asynciterator');
let QuadStore = null;

setImmediate(() => {
  QuadStore = require('../../quadstore');
});

class BindingsIterator extends AsyncIterator.TransformIterator {

  constructor(store, matchTerms, termToVariableMappings) {
    super();

    this._transform = (quad, done) => {
      const binding = {};
      for (const term in termToVariableMappings) {
        if (termToVariableMappings.hasOwnProperty(term)) {
          binding[termToVariableMappings[term]] = quad[term];
        }
      }
      this._push(binding);
      done();
    };

    QuadStore.prototype.getStream.call(store, matchTerms)
      .then((iterator) => { this.source = iterator; })
      .catch((err) => { this.destroy(); });

    // TODO: error propagation
  }

}

module.exports = BindingsIterator;
