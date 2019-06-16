import { expect } from 'chai';
import { loadMap, saveMap, DDNetMap } from '../src';
import fs from 'fs';
import BSON from 'bson';

describe('parse a map', () => {
    let map: DDNetMap;
    let map2: DDNetMap;
    before(() => {
        map = loadMap(__dirname + '/Test.map');
        fs.writeFileSync(__dirname + '/TestOut.map', saveMap(map));
        map2 = loadMap(__dirname + '/TestOut.map');
        // fs.writeFileSync('out.json', JSON.stringify(map, null, 4));
    });

    it('should parse the map', () => {
        expect(map).to.be.a('object');
        console.log(map);
    });
});
