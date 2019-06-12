import crypto from 'crypto';
import { UUIDError } from './errors';

export enum UUIDConstants {
    UUID_MAXSTRSIZE = 37, // 12345678-0123-5678-0123-567890123456

    UUID_INVALID = -2,
    UUID_UNKNOWN = -1,

    OFFSET_UUID = 1 << 16,
}

export class Uuid {
    public data: Buffer;

    public constructor(data: Buffer) {
        this.data = data;
    }
}

export class UuidName {
    public uuid: Uuid;
    public name: string;

    public constructor(uuid: Uuid, name: string) {
        this.uuid = uuid;
        this.name = name;
    }
}

export class UuidManager {
    public names: UuidName[] = [];

    public calculateUuid(name: string) {
        let buffer = crypto
            .createHash('md5')
            .update(
                Buffer.from([
                    0xe0,
                    0x5d,
                    0xda,
                    0xaa,
                    0xc4,
                    0xe6,
                    0x4c,
                    0xfb,
                    0xb6,
                    0x42,
                    0x5d,
                    0x48,
                    0xe8,
                    0x0c,
                    0x00,
                    0x29,
                ]),
            )
            .update(name)
            .digest();
        buffer[6] &= 0x0f;
        buffer[6] |= 0x30;
        buffer[8] &= 0x3f;
        buffer[8] |= 0x80;
        return new Uuid(buffer);
    }

    public registerName(id: number, name: string) {
        if (this.getIndex(id) !== this.names.length) {
            throw new UUIDError('names must be registered with increasing ID.');
        }

        let uuid = this.calculateUuid(name);

        if (this.lookupUuid(uuid) != UUIDConstants.UUID_UNKNOWN) {
            throw new UUIDError('Duplicate id');
        }

        const obj = new UuidName(this.calculateUuid(name), name);
        this.names.push(obj);
    }

    public getUuid(id: number) {
        return this.names[id].uuid;
    }

    public getName(id: number) {
        return this.names[id].name;
    }

    public getID(index: number) {
        return index + UUIDConstants.OFFSET_UUID;
    }

    public getIndex(id: number) {
        return id - UUIDConstants.OFFSET_UUID;
    }

    public lookupUuid(uuid: Uuid) {
        for (let i = 0; i < this.names.length; i++) {
            if (this.names[i].uuid.data === uuid.data) return this.getID(i);
        }
        return UUIDConstants.UUID_UNKNOWN;
    }
}
