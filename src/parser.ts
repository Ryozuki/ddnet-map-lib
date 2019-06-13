import { SmartBuffer } from 'smart-buffer';
import fs, { PathLike } from 'fs';
import { InvalidVersionHeaderError } from './errors';
import zlib from 'zlib';
import { ItemTypes } from './ItemTypes';
import util from 'util';
import BSON from 'bson';
import { LayerTypes } from './LayerTypes';
import { TilesLayerFlags } from './TilesLayerFlags';
import { TileTypes } from './TileTypes';
import { EntityTypes } from './EntityTypes';
import { DDNetMap } from './DDNetMap';

/*
Images on layers are referenced by their id.
*/

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

function getPoint(data: SmartBuffer) {
    return {
        x: data.readInt32LE(),
        y: data.readInt32LE(),
    };
}

function getColor(data: SmartBuffer) {
    return {
        r: data.readInt32LE(),
        g: data.readInt32LE(),
        b: data.readInt32LE(),
        a: data.readInt32LE(),
    };
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

export function mapToObject(pathOrData: PathLike | number, bson: boolean = true): DDNetMap {
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
        if (item.type === ItemTypes.VERSION) {
            dataItems.push({
                type: item.type,
                id: item.id,
                data: {
                    version: item.itemData.readInt32LE(),
                },
            });
        } else if (item.type === ItemTypes.INFO) {
            item.itemData.readOffset = 0;
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
            item.itemData.readOffset = 0;
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
            item.itemData.readOffset = 0;
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
            item.itemData.readOffset = 0;
            let group: any = {
                type: item.type,
                id: item.id,
                data: {
                    version: item.itemData.readInt32LE(),
                    index: currentGroupIndex,
                    offset: getPoint(item.itemData),
                    parallax: getPoint(item.itemData),
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
                },
            };
            currentGroupIndex++;
            groups.push(group);
        } else if (item.type === ItemTypes.ENVELOPE) {
            let data = {
                version: item.itemData.readInt32LE(),
                channels: item.itemData.readInt32LE(),
                startPoint: item.itemData.readInt32LE(),
                numPoints: item.itemData.readInt32LE(),
                name: intsToStr([
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                    item.itemData.readInt32LE(),
                ]),
                synchronized: item.itemData.readInt32LE(),
            };
            dataItems.push({
                type: item.type,
                id: item.id,
                data,
            });
        } else if (item.type == ItemTypes.ENVPOINTS) {
            item.itemData.readOffset = 0;
            if (item.itemData.length === 0) {
                // TODO: figure out why this can be empty
                continue;
            }
            let envelope = {
                type: item.type,
                id: item.id,
                data: {
                    time: item.itemData.readInt32LE(), // in ms
                    curveType: item.itemData.readInt32LE(),
                    values: [
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                    ],
                },
            };
            dataItems.push(envelope);
        } else if (item.type === ItemTypes.LAYER) {
            item.itemData.readOffset = 0;
            let layer: any = {
                type: item.type,
                id: item.id,
                data: {
                    index: currentLayerIndex,
                    version: item.itemData.readInt32LE(),
                    layerType: item.itemData.readInt32LE(),
                    flags: item.itemData.readInt32LE(),
                },
            };

            currentLayerIndex++;

            if (layer.data.layerType === LayerTypes.TILES) {
                layer.data.tilemap = {
                    version: item.itemData.readInt32LE(),
                    width: item.itemData.readInt32LE(),
                    height: item.itemData.readInt32LE(),
                    flags: item.itemData.readInt32LE(),
                    color: getColor(item.itemData),
                    colorEnv: item.itemData.readInt32LE(),
                    colorOffset: item.itemData.readInt32LE(),
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
                layer.data.tilemap.data.readOffset = 0;

                layer.data.tilemap.game = layer.data.tilemap.flags & TilesLayerFlags.GAME;

                if (layer.data.tilemap.flags & TilesLayerFlags.TELE) {
                    let teleTypes = [
                        TileTypes.TELEIN,
                        TileTypes.TELEINEVIL,
                        TileTypes.TELEOUT,
                        TileTypes.TELECHECK,
                        TileTypes.TELECHECKIN,
                        TileTypes.TELECHECKINEVIL,
                        TileTypes.TELECHECKOUT,
                        TileTypes.TELEINWEAPON,
                        TileTypes.TELEINHOOK,
                    ];

                    let teleData = dataFiles[layer.data.tilemap.tele];

                    for (let i = 0; i < layer.data.tilemap.width * layer.data.tilemap.height; i++) {
                        let teleTile = {
                            number: teleData.readUInt8(),
                            type: teleData.readUInt8(),
                        };

                        layer.data.tilemap.tiles.push({
                            index: 0,
                            skip: 0,
                            flags: 0,
                            reserved: 0,
                        });

                        for (let e in teleTypes) {
                            if (teleTile.type === teleTypes[e]) {
                                layer.data.tilemap.tiles[i].index = teleTypes[e];
                                layer.data.tilemap.tiles[i].data = teleTile;
                            }
                        }
                    }
                } else if (layer.data.tilemap.flags & TilesLayerFlags.SPEEDUP) {
                    let speedData = dataFiles[layer.data.tilemap.speedup];

                    for (let i = 0; i < layer.data.tilemap.width * layer.data.tilemap.height; i++) {
                        let speedupTile = {
                            force: speedData.readUInt8(),
                            maxSpeed: speedData.readUInt8(),
                            type: speedData.readUInt8(),
                            angle: speedData.readInt16LE(),
                        };

                        layer.data.tilemap.tiles.push({
                            index: 0,
                            skip: 0,
                            flags: 0,
                            reserved: 0,
                        });

                        if (speedupTile.force > 0) {
                            layer.data.tilemap.tiles[i].index = TileTypes.BOOST;
                            layer.data.tilemap.tiles[i].data = speedupTile;
                        }
                    }
                } else if (layer.data.tilemap.flags & TilesLayerFlags.FRONT) {
                    let frontData = dataFiles[layer.data.tilemap.front];

                    for (let i = 0; i < layer.data.tilemap.width * layer.data.tilemap.height; i++) {
                        layer.data.tilemap.tiles.push({
                            index: frontData.readUInt8(),
                            flags: frontData.readUInt8(),
                            skip: frontData.readUInt8(),
                            reserved: frontData.readUInt8(),
                        });
                    }
                } else if (layer.data.tilemap.flags & TilesLayerFlags.SWITCH) {
                    let switchData = dataFiles[layer.data.tilemap.switch];

                    let switchTypes = [
                        TileTypes.SWITCHTIMEDOPEN,
                        TileTypes.SWITCHTIMEDCLOSE,
                        TileTypes.SWITCHOPEN,
                        TileTypes.SWITCHCLOSE,
                        TileTypes.FREEZE,
                        TileTypes.DFREEZE,
                        TileTypes.DUNFREEZE,
                        TileTypes.HIT_START,
                        TileTypes.HIT_END,
                        TileTypes.JUMP,
                        TileTypes.PENALTY,
                        TileTypes.BONUS,
                        TileTypes.ALLOW_TELE_GUN,
                        TileTypes.ALLOW_BLUE_TELE_GUN,
                    ];

                    for (let i = 0; i < layer.data.tilemap.width * layer.data.tilemap.height; i++) {
                        layer.data.tilemap.tiles.push({
                            index: 0,
                            skip: 0,
                            flags: 0,
                            reserved: 0,
                        });

                        let switchTile = {
                            number: switchData.readUInt8(),
                            type: switchData.readUInt8(),
                            flags: switchData.readUInt8(),
                            delay: switchData.readUInt8(),
                        };

                        if (
                            (switchTile.type > EntityTypes.CRAZY_SHOTGUN + EntityTypes.ENTITY_OFFSET &&
                                switchTile.type < EntityTypes.DRAGGER_WEAK + EntityTypes.ENTITY_OFFSET) ||
                            switchTile.type == EntityTypes.LASER_O_FAST + EntityTypes.ENTITY_OFFSET
                        ) {
                            continue;
                        } else if (
                            switchTile.type >= EntityTypes.ARMOR_1 + EntityTypes.ENTITY_OFFSET &&
                            switchTile.type <= EntityTypes.DOOR + EntityTypes.ENTITY_OFFSET
                        ) {
                            layer.data.tilemap.tiles[i].index = switchTile.type;
                            layer.data.tilemap.tiles[i].flags = switchTile.flags;
                            layer.data.tilemap.tiles[i].data = switchTile;
                        }

                        for (let e in switchTypes) {
                            if (switchTile.type === switchTypes[e]) {
                                layer.data.tilemap.tiles[i].type = switchTypes[e];
                                layer.data.tilemap.tiles[i].flags = switchTile.flags;
                                layer.data.tilemap.tiles[i].data = switchTile;
                            }
                        }
                    }
                } else if (layer.data.tilemap.flags & TilesLayerFlags.TUNE) {
                    let tuneData = dataFiles[layer.data.tilemap.tune];

                    for (let i = 0; i < layer.data.tilemap.width * layer.data.tilemap.height; i++) {
                        let tuneTile = {
                            number: tuneData.readUInt8(),
                            type: tuneData.readUInt8(),
                        };

                        layer.data.tilemap.tiles.push({
                            index: 0,
                            skip: 0,
                            flags: 0,
                            reserved: 0,
                        });

                        if (tuneTile.type === TileTypes.TUNE1) {
                            layer.data.tilemap.tiles[i].index = TileTypes.TUNE1;
                            layer.data.tilemap.tiles[i].data = tuneTile;
                        }
                    }
                } else {
                    for (let i = 0; i < layer.data.tilemap.width * layer.data.tilemap.height; i++) {
                        layer.data.tilemap.tiles.push({
                            index: layer.data.tilemap.data.readUInt8(),
                            flags: layer.data.tilemap.data.readUInt8(),
                            skip: layer.data.tilemap.data.readUInt8(),
                            reserved: layer.data.tilemap.data.readUInt8(),
                        });
                        if (layer.data.tilemap.game && layer.data.tilemap.version == (1 << 16) + 23 * 4) {
                            layer.data.tilemap.tiles[i].index += EntityTypes.ENTITY_OFFSET;
                        }
                    }
                }
                delete layer.data.tilemap.data;
            } else if (layer.data.layerType === LayerTypes.QUADS) {
                layer.data.quadInfo = {
                    version: item.itemData.readInt32LE(),
                    numQuads: item.itemData.readInt32LE(),
                    data: dataFiles[item.itemData.readInt32LE()],
                    image: item.itemData.readInt32LE(),
                    name: intsToStr([
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                    ]),
                };

                layer.data.quads = [];

                let quadData = layer.data.quadInfo.data;

                for (let i = 0; i < layer.data.quadInfo.numQuads; i++) {
                    layer.data.quads.push({
                        points: [
                            getPoint(quadData),
                            getPoint(quadData),
                            getPoint(quadData),
                            getPoint(quadData),
                            getPoint(quadData),
                        ],
                        colors: [getColor(quadData), getColor(quadData), getColor(quadData), getColor(quadData)],
                        texCoords: [getPoint(quadData), getPoint(quadData), getPoint(quadData), getPoint(quadData)],
                        posEnv: quadData.readInt32LE(),
                        posEnvOffset: quadData.readInt32LE(),
                        colorEnv: quadData.readInt32LE(),
                        colorEnvOffset: quadData.readInt32LE(),
                    });
                }

                delete layer.data.quadInfo.data;
            } else if (layer.data.layerType === LayerTypes.SOUNDS) {
                layer.data.soundInfo = {
                    version: item.itemData.readInt32LE(),
                    numSources: item.itemData.readInt32LE(),
                    data: dataFiles[item.itemData.readInt32LE()],
                    sound: item.itemData.readInt32LE(),
                    name: intsToStr([
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                        item.itemData.readInt32LE(),
                    ]),
                };

                let sourcesData = layer.data.soundInfo.data;

                layer.data.sources = [];
                for (let i = 0; i < layer.data.soundInfo.numSources; i++) {
                    layer.data.sources.push({
                        position: getPoint(sourcesData),
                        loop: sourcesData.readInt32LE(),
                        pan: sourcesData.readInt32LE(),
                        timeDelay: sourcesData.readInt32LE(),
                        falOff: sourcesData.readInt32LE(),
                        posEnv: sourcesData.readInt32LE(),
                        posEnvOffset: sourcesData.readInt32LE(),
                        soundEnv: sourcesData.readInt32LE(),
                        soundEnvOffset: sourcesData.readInt32LE(),
                        shape: {
                            type: sourcesData.readInt32LE(),
                            widthOrRadius: sourcesData.readInt32LE(), // if shape is circle, this is the radius too
                            height: sourcesData.readInt32LE(),
                        },
                    });
                }

                delete layer.data.soundInfo.data;
            }
            // TODO: add support for deprecated sound layer?
            layers.push(layer);
        } else if (item.type === ItemTypes.AUTOMAPPER_CONFIG) {
            let data = {
                version: item.itemData.readInt32LE(),
                groupID: item.itemData.readInt32LE(),
                layerID: item.itemData.readInt32LE(),
                autoMapperConfig: item.itemData.readInt32LE(),
                automapperSeed: item.itemData.readInt32LE(),
                flags: item.itemData.readInt32LE(),
            };

            dataItems.push({
                type: item.type,
                id: item.id,
                data,
            });
        } else {
            console.log('Unknown type found: ', item.type);
        }
    }

    for (let i in groups) {
        groups[i].data.layers = [];
        for (let j = groups[i].data.startLayer; j < groups[i].data.startLayer + groups[i].data.numLayers; j++) {
            groups[i].data.layers.push(layers[j]);
        }
    }

    map.items = dataItems.concat(groups);

    // console.log(util.inspect(map, { showHidden: false, depth: 7, colors: true, compact: false }));
    //console.log(util.inspect(groups, { showHidden: false, depth: null, colors: true, compact: false }));
    //console.log(util.inspect(layers, { showHidden: false, depth: null, colors: true, compact: false }));
    return map as DDNetMap;
}

export function objectToMap(data: object) {}
