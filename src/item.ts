import { SmartBuffer } from 'smart-buffer';

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
    public itemData: Buffer;
    public type: ItemTypes;
    public id: number;

    public constructor(data: SmartBuffer) {
        this.typeAndID = data.readInt32LE();
        this.size = data.readInt32LE();
        this.itemData = data.readBuffer(this.size);

        this.type = (this.typeAndID >> 16) & 0xffff;
        this.id = this.typeAndID & 0xffff;
    }
}
