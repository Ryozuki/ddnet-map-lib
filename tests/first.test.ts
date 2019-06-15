import { expect } from 'chai';
import { loadMap } from '../src';
import fs from 'fs';
import BSON from 'bson';

describe('parse a map', () => {
    let map: any;
    before(() => {
        map = loadMap(__dirname + '/Test.map');
        // fs.writeFileSync('out.json', JSON.stringify(map, null, 4));
    });

    it('should parse the map', () => {
        expect(map).to.be.a('object');
    });
});
