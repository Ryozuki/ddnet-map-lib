import { LayerTypes } from './LayerTypes';
import { TilesLayerFlags } from './TilesLayerFlags';

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface VersionData {
    version: number;
}

export interface InfoData {
    version: number;
    author: string | null;
    mapVersion: string | null;
    credits: string | null;
    license: string | null;
    settings: string | null;
}

export interface ImageData {
    version: number;
    width: number;
    height: number;
    external: number;
    name: string;
    imageData?: Buffer;
}

export interface SoundData {
    version: number;
    external: number;
    name: string;
    soundData?: Buffer;
    soundSize: number;
}

export interface Layer {
    index: number;
    version: number;
    layerType: LayerTypes;
    flags: number;
}

export interface TeleTileData {
    number: number;
    type: number;
}

export interface SpeedupTileData {
    force: number;
    maxSpeed: number;
    type: number;
    angle: number;
}

export interface SwitchTileData {
    number: number;
    type: number;
    flags: number;
    delay: number;
}

export interface TuneTileData {
    number: number;
    type: number;
}

export interface Tile {
    index: number;
    flags: number;
    skip: number;
    reserver: number;
    data?: TeleTileData | SpeedupTileData | SwitchTileData | TuneTileData;
}

export interface TilesLayer extends Layer {
    tilemap: {
        version: number;
        width: number;
        height: number;
        flags: TilesLayerFlags;
        color: Color;
        colorEnv: number;
        colorOffset: number;
        image: number;
        name: string;
        tele: number;
        speedup: number;
        front: number;
        switch: number;
        tune: number;
        tiles: Tile[];
    };
}

export interface QuadsLayer {
    quadInfo: {
        version: number;
        numQuads: number;
        image: number;
        name: string;
    };
    quads: {
        points: [Point, Point, Point, Point, Point];
        colors: [Color, Color, Color, Color];
        posEnv: number;
        posEnvOffset: number;
        colorEnv: number;
        colorEnvOffset: number;
    }[];
}

export interface SoundsLayer {
    soundInfo: {
        version: number;
        numSources: number;
        sound: number;
        name: string;
    };
    sources: {
        position: number;
        loop: number;
        pan: number;
        timeDelay: number;
        falOff: number;
        posEnv: number;
        posEnvOffset: number;
        soundEnv: number;
        soundEnvOffset: number;
        shape: {
            type: number;
            widthOrRadius: number;
            height: number;
        };
    }[];
}

export interface Group {
    version: number;
    index: number;
    offset: Point;
    parallax: Point;
    startLayer: number;
    useClipping: number;
    clip: Rect;
    name: string;
    layers: (Layer | TilesLayer | QuadsLayer | SoundsLayer)[];
}

export interface Envelope {
    version: number;
    channels: number;
    startPoint: number;
    numPoints: number;
    name: string;
    synchronized: number;
}

export interface Envpoints {
    time: number;
    curveType: number;
    values: [number, number, number, number];
}

export interface AutomapperConfig {
    version: number;
    groupID: number;
    layerID: number;
    autoMapperConfig: number;
    automapperSeed: number;
    flags: number;
}

export interface Item {
    type: number;
    id: number;
    data: VersionData | InfoData | ImageData | Group | SoundData | Envelope | AutomapperConfig | Envpoints[];
}

export interface DDNetMap extends Object {
    _version: number;
    meta: {
        magic: string;
        version: number;
    };
    header: {
        size: number;
        swaplen: number;
        numItemTypes: number;
        numItems: number;
        numData: number;
        itemSize: number;
        dataSize: number;
    };
    items: Item[];
}
