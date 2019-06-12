import { SmartBuffer } from 'smart-buffer';
import fs, { PathLike } from 'fs';
import { InvalidVersionHeaderError } from './errors';
import zlib from 'zlib';
import { ItemTypes } from './ItemTypes';
import util from 'util';
import BSON from 'bson';
import { LayerTypes } from './LayerTypes';

function getString(itemData: SmartBuffer, dataFiles: SmartBuffer[]) {
    let i = itemData.readInt32LE();

    if (i > -1) {
        return dataFiles[i].readStringNT();
    }

    return null;
}

function getStrings(itemData: SmartBuffer, dataFiles: SmartBuffer[]) {
    let i = itemData.readInt32LE();

    if (i < 0) {
        return null;
    }

    let strings = [];

    while (dataFiles[i].readOffset !== dataFiles[i].length) {
        strings.push(dataFiles[i].readStringNT());
    }
    return strings;
}

function intsToStr(ints: number[]) {
    let text = '';

    for (let i in ints) {
        text += String.fromCharCode(((ints[i] >> 24) & 0xff) - 128);
        text += String.fromCharCode(((ints[i] >> 16) & 0xff) - 128);
        text += String.fromCharCode(((ints[i] >> 8) & 0xff) - 128);
        text += String.fromCharCode((ints[i] & 0xff) - 128);
    }
    // Remove content from first null char to end.
    return text.replace(/\0.*/g, '');
}

export function mapToJson(pathOrData: PathLike | number) {
    let map: any = {
        _version: 1,
    };

    let buffer = SmartBuffer.fromBuffer(fs.readFileSync(pathOrData));

    map.meta = {
        magic: buffer.readString(4, 'ascii'),
        version: buffer.readInt32LE(),
    };

    if (map.meta.magic !== 'DATA' && map.meta.magic !== 'ATAD') {
        throw new InvalidVersionHeaderError(`Invalid header signature: '${map.meta.magic}'`);
    }

    if (map.meta.version !== 3 && map.meta.version !== 4) {
        throw new InvalidVersionHeaderError(`Wrong version. version = ${map.meta.version}`);
    }

    let header = {
        size: buffer.readInt32LE(),
        swaplen: buffer.readInt32LE(),
        numItemTypes: buffer.readInt32LE(),
        numItems: buffer.readInt32LE(),
        numData: buffer.readInt32LE(),
        itemSize: buffer.readInt32LE(),
        dataSize: buffer.readInt32LE(),
    };

    let itemTypes = [];

    for (let i = 0; i < header.numItemTypes; i++) {
        itemTypes.push({
            typeID: buffer.readInt32LE(),
            start: buffer.readInt32LE(),
            num: buffer.readInt32LE(),
        });
    }

    let itemOffsets = [];

    for (let i = 0; i < header.numItems; i++) {
        itemOffsets.push(buffer.readInt32LE());
    }

    let dataOffsets = [];

    for (let i = 0; i < header.numData; i++) {
        dataOffsets.push(buffer.readInt32LE());
    }

    let dataSizes = [];

    if (map.meta.version == 4) {
        for (let i = 0; i < header.numData; i++) {
            dataSizes.push(buffer.readInt32LE());
        }
    }

    let itemsBuffer = SmartBuffer.fromBuffer(buffer.readBuffer(header.itemSize));
    let dataBuffer = SmartBuffer.fromBuffer(buffer.readBuffer(header.dataSize));

    // Parse data files
    let dataFiles = [];

    for (let i = 0; i < header.numData; i++) {
        let size = 0;
        if (i === header.numData - 1) {
            size = header.dataSize - dataOffsets[i];
        } else {
            size = dataOffsets[i + 1] - dataOffsets[i];
        }

        if (map.meta.version === 4) {
            const uncompressedSize = dataSizes[i];
            const data = dataBuffer.readBuffer(size);

            dataFiles.push(SmartBuffer.fromBuffer(zlib.inflateSync(data)));

            if (dataFiles[i].length !== uncompressedSize) {
                console.error(
                    `Uncompressed size doesn't match. index=${i}, expected=${uncompressedSize} actual=${dataFiles[i].length}`,
                );
            }
        } else {
            const data = dataBuffer.readBuffer(size);
            dataFiles.push(SmartBuffer.fromBuffer(data));
        }
    }

    // Parse items
    let items = [];

    for (let i = 0; i < header.numItems; i++) {
        let typeAndID = itemsBuffer.readInt32LE();
        let size = itemsBuffer.readInt32LE();
        let itemData = SmartBuffer.fromBuffer(itemsBuffer.readBuffer(size));

        let type = (typeAndID >> 16) & 0xffff;
        let id = typeAndID & 0xffff;
        items.push({
            typeAndID,
            size,
            itemData,
            type,
            id,
        });
    }

    let dataItems = [];

    let layers: any[] = [];
    let groups = [];

    let currentLayerIndex = 0;
    let currentGroupIndex = 0;

    for (let item of items) {
        if (item.type === ItemTypes.INFO) {
            dataItems.push({
                type: item.type,
                id: item.id,
                data: {
                    version: getString(item.itemData, dataFiles),
                    author: getString(item.itemData, dataFiles),
                    mapVersion: getString(item.itemData, dataFiles),
                    credits: getString(item.itemData, dataFiles),
                    license: getString(item.itemData, dataFiles),
                    settings: getStrings(item.itemData, dataFiles),
                },
            });
        } else if (item.type === ItemTypes.IMAGE) {
            let data: any = {
                version: item.itemData.readInt32LE(),
                width: item.itemData.readInt32LE(),
                height: item.itemData.readInt32LE(),
                external: item.itemData.readInt32LE(),
                name: getString(item.itemData, dataFiles),
            };

            let dataID = item.itemData.readInt32LE();

            if (!data.external) {
                data.imageData = zlib.deflateSync(dataFiles[dataID].toBuffer());
            }

            dataItems.push({
                type: item.type,
                id: item.id,
                data,
            });
        } else if (item.type === ItemTypes.SOUND) {
            let data: any = {
                version: item.itemData.readInt32LE(),
                external: item.itemData.readInt32LE(),
                name: getString(item.itemData, dataFiles),
            };

            let dataID = item.itemData.readInt32LE();

            if (!data.external) {
                data.soundData = zlib.deflateSync(dataFiles[dataID].toBuffer());
            }
            data.soundSize = item.itemData.readInt32LE();

            dataItems.push({
                type: item.type,
                id: item.id,
                data,
            });
        } else if (item.type === ItemTypes.GROUP) {
            let group: any = {
                type: item.type,
                id: item.id,
                version: item.itemData.readInt32LE(),
                index: currentGroupIndex,
                offset: {
                    x: item.itemData.readInt32LE(),
                    y: item.itemData.readInt32LE(),
                },
                parallax: {
                    x: item.itemData.readInt32LE(),
                    y: item.itemData.readInt32LE(),
                },
                startLayer: item.itemData.readInt32LE(),
                numLayers: item.itemData.readInt32LE(),
                useClipping: item.itemData.readInt32LE(),
                clip: {
                    x: item.itemData.readInt32LE(),
                    y: item.itemData.readInt32LE(),
                    w: item.itemData.readInt32LE(),
                    h: item.itemData.readInt32LE(),
                },
                name: intsToStr([
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                ]),
            };
            currentGroupIndex++;
            groups.push(group);
        } else if (item.type === ItemTypes.LAYER) {
            let layer: any = {
                type: item.type,
                id: item.id,
                index: currentLayerIndex,
                version: item.itemData.readInt32LE(),
                layerType: item.itemData.readInt32LE(),
                flags: item.itemData.readInt32LE(),
            };

            currentLayerIndex++;

            if (layer.layerType === LayerTypes.TILES) {
                layer.tilemap = {
                    version: item.itemData.readInt32LE(),
                    width: item.itemData.readInt32LE(),
                    height: item.itemData.readInt32LE(),
                    flags: item.itemData.readInt32LE(),
                    color: {
                        r: item.itemData.readInt32LE(),
                        g: item.itemData.readInt32LE(),
                        b: item.itemData.readInt32LE(),
                        a: item.itemData.readInt32LE(),
                        env: item.itemData.readInt32LE(),
                        offset: item.itemData.readInt32LE(),
                    },
                    image: item.itemData.readInt32LE(),
                    data: dataFiles[item.itemData.readInt32LE()],
                    name: intsToStr([
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                    ]),
                    tele: item.itemData.readInt32LE(),
                    speedup: item.itemData.readInt32LE(),
                    front: item.itemData.readInt32LE(),
                    switch: item.itemData.readInt32LE(),
                    tune: item.itemData.readInt32LE(),
                    tiles: [],
                };
                layer.tilemap.data.readOffset = 0;
                for (let i = 0; i < layer.tilemap.width * layer.tilemap.height; i++) {
                    layer.tilemap.tiles.push({
                        index: layer.tilemap.data.readUInt8(),
                        flags: layer.tilemap.data.readUInt8(),
                        skip: layer.tilemap.data.readUInt8(),
                        reserved: layer.tilemap.data.readUInt8(),
                    });
                }

                // TODO: Load layer data for speedup front, etc
            }
            layers.push(layer);
        } else {
            console.log('Unknown type found: ', item.type);
        }
    }

    for (let i in groups) {
        groups[i].layers = [];
        for (let j = groups[i].startLayer; j < groups[i].startLayer + groups[i].numLayers; j++) {
            groups[i].layers.push(layers[j]);
        }
    }

    map.items = dataItems;
    map.items = map.items.concat(groups);

    console.log(util.inspect(map, { showHidden: false, depth: 6, colors: true, compact: false }));
    //console.log(util.inspect(groups, { showHidden: false, depth: null, colors: true, compact: false }));
    //console.log(util.inspect(layers, { showHidden: false, depth: null, colors: true, compact: false }));
    return BSON.serialize(map);
}

export function jsonToMap(data: object) {}
