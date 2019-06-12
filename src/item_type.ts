import { SmartBuffer } from 'smart-buffer';

export default class ItemType {
    /**
     * Unique type id.
     */
    public typeID: number;

    /**
     * Index of the first item.
     */
    public start: number;

    /**
     * Number of items with this typeID
     */
    public num: number;

    public constructor(data: Buffer) {
        const buffer = SmartBuffer.fromBuffer(data);

        this.typeID = buffer.readInt32LE();
        this.start = buffer.readInt32LE();
        this.num = buffer.readInt32LE();
    }
}
