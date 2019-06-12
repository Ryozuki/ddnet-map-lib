import { expect } from 'chai';
import { DDNetMap } from '../src';

describe('parse a map', () => {
    let map: DDNetMap;
    before(() => {
        map = DDNetMap.open(__dirname + '/Test.map');
    });

    it('should parse the version header', () => {
        expect(map.versionHeader.magic).to.equal('DATA');
        expect(map.versionHeader.version).to.equal(4);
    });

    it('should parse the header', () => {
        expect(map.header.size).to.be.a('number');
        expect(map.header.swaplen).to.be.a('number');
        expect(map.header.itemSize).to.be.a('number');
        expect(map.header.numData).to.be.a('number');
        expect(map.header.numItemTypes).to.be.a('number');
        expect(map.header.numItems).to.be.a('number');
        expect(map.header.dataSize).to.be.a('number');
    });

    it('should have a info item', () => {
        expect(map.info.author).to.equal('Ryozuki');
        expect(map.info.license).to.equal('mit');
        expect(map.info.credits).to.equal('thebest');
        expect(map.info.version).to.equal('2.3.0');
        expect(map.info.settings).to.be.an('array');
        expect(map.info.settings![0]).to.equal('stupid_command 1');
    });
});
