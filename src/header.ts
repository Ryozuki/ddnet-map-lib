import { SmartBuffer } from 'smart-buffer';

export default class MapHeader {
    public size: number;
    public swaplen: number;
    public numItemTypes: number;
    public numItems: number;
    public numData: number;
    public itemSize: number;
    public dataSize: number;

    public constructor(data: Buffer) {
        const buffer = SmartBuffer.fromBuffer(data);

        this.size = buffer.readInt32LE();
        this.swaplen = buffer.readInt32LE();
        this.numItemTypes = buffer.readInt32LE();
        this.numItems = buffer.readInt32LE();
        this.numData = buffer.readInt32LE();
        this.itemSize = buffer.readInt32LE();
        this.dataSize = buffer.readInt32LE();
    }
}
