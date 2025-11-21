import { IReadable } from '@mcap/core/dist/cjs/src/types';

export class UniversalHttpReader implements IReadable {
    private url: string;
    private _size: number | undefined;
    private additionalHeaders: Record<string, string>;

    constructor(url: string, additionalHeaders: Record<string, string> = {}) {
        this.url = url;
        this.additionalHeaders = additionalHeaders;
    }

    async init(): Promise<void> {
        const response = await fetch(this.url, {
            method: 'HEAD',
            headers: this.additionalHeaders,
        });

        if (!response.ok) {
            const getResponse = await fetch(this.url, {
                headers: {
                    Range: 'bytes=0-0',
                    ...this.additionalHeaders,
                },
            });
            if (!getResponse.ok)
                throw new Error(
                    `Failed to access file: ${getResponse.statusText}`,
                );

            const range = getResponse.headers.get('Content-Range');
            if (range) {
                this._size = Number.parseInt(range.split('/')[1] || '0', 10);
                return;
            }
        }

        const length = response.headers.get('Content-Length');
        if (length) {
            this._size = Number.parseInt(length, 10);
        } else {
            throw new Error('Could not determine file size');
        }
    }

    async size(): Promise<bigint> {
        if (this._size === undefined) await this.init();
        return BigInt(this._size ?? 0);
    }

    get sizeBytes(): number {
        return this._size ?? 0;
    }

    async read(offset: bigint, length: bigint): Promise<Uint8Array> {
        const start = Number(offset);
        const end = start + Number(length) - 1;

        const response = await fetch(this.url, {
            headers: {
                Range: `bytes=${start}-${end}`,
                ...this.additionalHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(`Read failed: ${response.statusText}`);
        }

        return new Uint8Array(await response.arrayBuffer());
    }
}
