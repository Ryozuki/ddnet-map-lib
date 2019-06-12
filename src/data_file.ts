import { SmartBuffer } from 'smart-buffer';

export default class DataFile {
    public data: SmartBuffer;

    public constructor(data: Buffer) {
        this.data = SmartBuffer.fromBuffer(data);
    }
}
