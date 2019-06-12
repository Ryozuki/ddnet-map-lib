import { expect } from 'chai';
import { DDNetMap } from '../src';

describe('load a map', () => {
    it('should work', () => {
        let map = DDNetMap.open(__dirname + '/Test.map');
        console.log(map.versionHeader);
        console.log(map.header);
        console.log(map.itemTypes);
        console.log(map.items);
        console.log(map.dataFiles);
        expect(map.versionHeader.magic === 'DATA', 'magic shoulkd match');
        expect(map.versionHeader.version === 4, 'version should be 4');
    });
});
