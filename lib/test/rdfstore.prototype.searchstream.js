'use strict';
const _ = require('../lib/utils/lodash');
const should = require('should');
const enums = require('../lib/utils/enums');
const utils = require('../lib/utils');
const factory = require('@rdfjs/data-model');
module.exports = () => {
    describe('RdfStore.prototype.searchStream()', () => {
        beforeEach(async function () {
            const quads = [
                factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p'), factory.namedNode('http://ex.com/o'), factory.namedNode('http://ex.com/g')),
                factory.quad(factory.namedNode('http://ex.com/s'), factory.namedNode('http://ex.com/p2'), factory.namedNode('http://ex.com/o2'), factory.namedNode('http://ex.com/g2')),
                factory.quad(factory.namedNode('http://ex.com/s2'), factory.namedNode('http://ex.com/p'), factory.namedNode('http://ex.com/o'), factory.namedNode('http://ex.com/g')),
                factory.quad(factory.namedNode('http://ex.com/s2'), factory.namedNode('http://ex.com/p'), factory.namedNode('http://ex.com/o2'), factory.namedNode('http://ex.com/g')),
                factory.quad(factory.namedNode('http://ex.com/s2'), factory.namedNode('http://ex.com/p2'), factory.namedNode('http://ex.com/o2'), factory.namedNode('http://ex.com/g2')),
            ];
            await this.store.put(quads);
        });
        it('should match quads by subject', async function () {
            const patterns = [
                {
                    subject: factory.variable('s'),
                    predicate: factory.namedNode('http://ex.com/p'),
                    object: factory.namedNode('http://ex.com/o'),
                },
                {
                    subject: factory.variable('s'),
                    predicate: factory.namedNode('http://ex.com/p2'),
                    object: factory.variable('o'),
                },
            ];
            const filters = [
                { type: 'lt', args: [factory.variable('o'), factory.variable('s')] }
            ];
            const results = await this.store.searchStream(patterns, filters);
            should(results.type).equal(enums.resultType.BINDINGS);
            const bindings = await utils.streamToArray(results.iterator);
            console.log(bindings);
        });
    });
};
