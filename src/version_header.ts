import { SmartBuffer } from 'smart-buffer';
import { InvalidVersionHeaderError } from './errors';

export default class VersionHeader {
    public magic: string;
    public version: number;

    public constructor(data: Buffer) {
        const buffer = SmartBuffer.fromBuffer(data);

        this.magic = buffer.readString(4, 'ascii');
        this.version = buffer.readInt32LE();

        if (this.magic !== 'DATA' && this.magic !== 'ATAD') {
            throw new InvalidVersionHeaderError(`Invalid header signature: '${this.magic}'`);
        }

        if (this.version !== 3 && this.version !== 4) {
            throw new InvalidVersionHeaderError(`Wrong version. version = ${this.version}`);
        }
    }
}
