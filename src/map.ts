import fs from 'fs';
import { SmartBuffer } from 'smart-buffer';
import MapHeader from './header';
import VersionHeader from './version_header';
import ItemType from './item_type';
import DataFile from './data_file';
import zlib from 'zlib';
import { UuidManager } from './uuid';
import { Item, ItemInfo, ItemTypes } from './item';

export enum DataFileConstants {
    OFFSET_UUID_TYPE = 0x8000,
    ITEMTYPE_EX = 0xffff,
}

export class DDNetMap {
    private buffer: SmartBuffer;
    public versionHeader: VersionHeader;
    public header: MapHeader;
    public itemTypes: ItemType[] = [];
    public itemOffsets: number[] = [];
    public dataOffsets: number[] = [];
    public dataSizes: number[] = [];
    public dataStartOffset: number = 0;
    public uuidManager: UuidManager;
    public items: Item[] = [];
    public dataFiles: DataFile[] = [];
    public info: ItemInfo;

    public constructor(data: Buffer) {
        this.uuidManager = new UuidManager();
        this.buffer = SmartBuffer.fromBuffer(data);

        this.versionHeader = new VersionHeader(this.buffer.readBuffer(8));
        this.header = new MapHeader(this.buffer.readBuffer(28));

        for (let i = 0; i < this.header.numItemTypes; i++) {
            this.itemTypes.push(new ItemType(this.buffer.readBuffer(12)));
        }

        for (let i = 0; i < this.header.numItems; i++) {
            this.itemOffsets.push(this.buffer.readInt32LE());
        }

        for (let i = 0; i < this.header.numData; i++) {
            this.dataOffsets.push(this.buffer.readInt32LE());
        }

        if (this.versionHeader.version >= 4) {
            for (let i = 0; i < this.header.numData; i++) {
                this.dataSizes.push(this.buffer.readInt32LE());
            }
        }

        this.dataStartOffset =
            8 +
            28 +
            12 * this.header.numItemTypes +
            4 * this.header.numItems +
            4 * this.header.numData +
            this.header.itemSize;

        if (this.versionHeader.version === 4) {
            this.dataStartOffset += 4 * this.header.numData;
        }

        for (let i = 0; i < this.header.numItems; i++) {
            this.items.push(new Item(this.buffer));
        }

        for (let i = 0; i < this.header.numData; i++) {
            let size = this.getFileDataSize(i);
            if (this.versionHeader.version === 4) {
                const uncompressedSize = this.dataSizes[i];
                const data = this.buffer.readBuffer(size);

                this.dataFiles.push(new DataFile(zlib.inflateSync(data)));

                if (this.dataFiles[i]!.data.length !== uncompressedSize) {
                    console.error(
                        `Uncompressed size doesn't match. index=${i}, expected=${uncompressedSize} actual=${
                            this.dataFiles[i]!.data.length
                        }`,
                    );
                }
            } else {
                const data = this.buffer.readBuffer(size);
                this.dataFiles.push(new DataFile(data));
            }
        }

        // Load map info
        let infoType = this.getType(ItemTypes.INFO)!;
        let item = this.getItem(infoType.start);
        this.info = new ItemInfo(item, this.dataFiles);
    }

    public static open(path: string | number | Buffer | URL) {
        return new this(fs.readFileSync(path));
    }

    /**
     * Returns the size in the file
     * @param index
     */
    public getFileDataSize(index: number) {
        if (index === this.header.numData - 1) {
            return this.header.dataSize - this.dataOffsets[index];
        }
        return this.dataOffsets[index + 1] - this.dataOffsets[index];
    }

    /**
     * Returns the size of the resulting data
     * @param index
     */
    public getDataSize(index: number) {
        if (this.versionHeader.version === 4) {
            return this.dataSizes[index];
        }
        return this.getFileDataSize(index);
    }

    public getItemSize(index: number) {
        if (index === this.header.numItems - 1) {
            return this.header.itemSize - this.itemOffsets[index] - 8;
        }
        return this.itemOffsets[index + 1] - this.itemOffsets[index] - 8;
    }

    public getType(type: number) {
        for (let i in this.itemTypes) {
            if (this.itemTypes[i].typeID == type) {
                return this.itemTypes[i];
            }
        }
    }

    public getItem(index: number) {
        return this.items[index];
    }
}
