import { expect } from 'chai';
import { mapToObject } from '../src';
import fs from 'fs';
import BSON from 'bson';

describe('parse a map', () => {
    let map: any;
    before(() => {
        map = mapToObject(__dirname + '/Test.map');
        fs.writeFileSync('out.bson', BSON.serialize(map));
    });

    it('should parse the map', () => {
        expect(map).to.be.a('object');
    });
});
