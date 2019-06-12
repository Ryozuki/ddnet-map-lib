import { SmartBuffer } from 'smart-buffer';
import DataFile from './data_file';

export enum ItemTypes {
    VERSION = 0,
    INFO,
    IMAGE,
    ENVELOPE,
    GROUP,
    LAYER,
    ENVPOINTS,
    SOUND,
}

export class Item {
    public typeAndID: number;
    public size: number;
    public itemData: SmartBuffer;
    public type: ItemTypes;
    public id: number;

    public constructor(data: SmartBuffer) {
        this.typeAndID = data.readInt32LE();
        this.size = data.readInt32LE();
        this.itemData = SmartBuffer.fromBuffer(data.readBuffer(this.size));

        this.type = (this.typeAndID >> 16) & 0xffff;
        this.id = this.typeAndID & 0xffff;
    }
}

function getStringOrNull(itemData: SmartBuffer, dataFiles: DataFile[]) {
    let i = itemData.readInt32LE();

    if (i > -1) {
        return dataFiles[i].data.readStringNT();
    }

    return null;
}

function getStringsOrNull(itemData: SmartBuffer, dataFiles: DataFile[]) {
    let i = itemData.readInt32LE();

    if (i < 0) {
        return null;
    }

    let strings = [];

    while (dataFiles[i].data.readOffset !== dataFiles[i].data.length) {
        strings.push(dataFiles[i].data.readStringNT());
    }
    return strings;
}

export class ItemInfo {
    public item: Item;
    public version: string | null;
    public author: string | null;
    public mapVersion: string | null;
    public credits: string | null;
    public license: string | null;
    public settings: string[] | null;

    public constructor(item: Item, dataFiles: DataFile[]) {
        this.item = item;
        this.version = getStringOrNull(this.item.itemData, dataFiles);
        this.author = getStringOrNull(this.item.itemData, dataFiles);
        this.mapVersion = getStringOrNull(this.item.itemData, dataFiles);
        this.credits = getStringOrNull(this.item.itemData, dataFiles);
        this.license = getStringOrNull(this.item.itemData, dataFiles);
        this.settings = getStringsOrNull(this.item.itemData, dataFiles);
    }
}
