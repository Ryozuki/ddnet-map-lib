import { expect } from 'chai';
import { mapToJson } from '../src/parser';
import fs from 'fs';
import BSON from 'bson';
import util from 'util';

/*
describe('ok a map', () => {
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

*/

describe('parse a map', () => {
    let map: any;
    before(() => {
        map = mapToJson(__dirname + '/Test.map');
        fs.writeFileSync('out.bson', map);
    });

    it('should parse the map', () => {
        let realMap = BSON.deserialize(map);
        // console.log(util.inspect(realMap, { showHidden: false, depth: null, colors: true, compact: false }));
        expect(realMap).to.be.a('object');
    });
});
