import { IReadable } from '@mcap/core/dist/cjs/src/types';

export class UniversalHttpReader implements IReadable {
    private url: string;
    private _size: number | undefined;
    private _fullBuffer: ArrayBuffer | null = null;

    constructor(url: string) {
        this.url = url;
    }

    async init(): Promise<void> {
        const response = await fetch(this.url, {
            headers: { Range: 'bytes=0-0' },
        });

        // Handle servers ignoring Range requests (200 OK)
        if (response.status === 200) {
            this._fullBuffer = await response.arrayBuffer();
            this._size = this._fullBuffer.byteLength;
            return;
        }

        // Handle Content-Range or Content-Length
        if (response.ok) {
            const range = response.headers.get('Content-Range');
            this._size = range
                ? Number.parseInt(range.split('/')[1] || '0', 10)
                : Number.parseInt(
                      response.headers.get('Content-Length') || '0',
                      10,
                  );
        }

        if (!this._size) throw new Error('Could not determine file size');
    }

    // MCAP Interface
    async size(): Promise<bigint> {
        if (this._size === undefined) await this.init();
        return BigInt(this._size ?? 0);
    }

    // Rosbag Interface (synchronous size check)
    get sizeBytes(): number {
        return this._size || 0;
    }

    // Universal Read
    async read(
        offset: bigint | number,
        _length: bigint | number,
    ): Promise<Uint8Array> {
        const off = Number(offset);
        const length = Number(_length);

        if (this._fullBuffer) {
            return new Uint8Array(this._fullBuffer, off, length);
        }

        const end = off + length - 1;
        const response = await fetch(this.url, {
            headers: { Range: `bytes=${off}-${end}` },
        });
        if (!response.ok)
            throw new Error(`Read failed: ${response.statusText}`);

        return new Uint8Array(await response.arrayBuffer());
    }
}

export function formatPayload(data: any): string {
    if (!data) return '[Empty]';

    // Unified Binary formatting
    const isBinary = data instanceof Uint8Array || data?.type === 'Buffer';
    if (isBinary) {
        const array = data.data
            ? new Uint8Array(data.data)
            : new Uint8Array(data);
        const max = 12;
        const hex = [...array.subarray(0, max)]
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
        return `[Binary ${array.byteLength} bytes] <${hex}${array.byteLength > max ? '...' : ''}>`;
    }

    if (typeof data === 'object') {
        return JSON.stringify(
            data,
            (_, v) =>
                Array.isArray(v) && v.length > 20 ? `[Array(${v.length})]` : v,
            2,
        ).slice(0, 500); // Truncate generic large JSON
    }
    return String(data);
}
