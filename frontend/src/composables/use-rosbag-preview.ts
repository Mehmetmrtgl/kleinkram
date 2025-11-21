import { Bag } from '@foxglove/rosbag';
import { reactive, Ref, ref, shallowRef } from 'vue';

// --- Custom Reader Implementation ---
class HttpBagReader {
    private url: string;
    private _size: number;
    private _fullFileBuffer: ArrayBuffer | null;

    constructor(
        url: string,
        size: number,
        fullBuffer: ArrayBuffer | null = null,
    ) {
        this.url = url;
        this._size = size;
        this._fullFileBuffer = fullBuffer;
    }

    // 1. size() must be synchronous to match Filelike interface
    size(): number {
        return this._size;
    }

    // 2. read() returns a Promise<Uint8Array>
    async read(offset: number, length: number): Promise<Uint8Array> {
        // A. Serve from Memory (if we downloaded everything)
        if (this._fullFileBuffer) {
            return new Uint8Array(this._fullFileBuffer, offset, length);
        }

        // B. Try Range Request
        const end = offset + length - 1;
        const result = await fetch(this.url, {
            headers: { Range: `bytes=${offset}-${end}` },
        });

        if (!result.ok) {
            throw new Error(
                `HTTP ${result.status} fetching bytes ${offset}-${end}`,
            );
        }

        const buffer = await result.arrayBuffer();

        // C. Handle Unexpected 200 OK (Server ignored Range)
        if (result.status === 200) {
            console.warn(
                '[Rosbag] Server ignored Range (200 OK). Caching full file.',
            );
            this._fullFileBuffer = buffer;
            // Update size just in case
            this._size = buffer.byteLength;
            return new Uint8Array(this._fullFileBuffer, offset, length);
        }

        // D. Validation (Prevent "Offset outside bounds" error)
        if (
            buffer.byteLength < length &&
            offset + buffer.byteLength < this._size
        ) {
            throw new Error(
                `Short read: Expected ${length} bytes, got ${buffer.byteLength}`,
            );
        }

        return new Uint8Array(buffer);
    }
}

function formatPayload(data: any): string {
    if (!data) return '[Empty]';

    if (typeof data === 'object') {
        if (data instanceof Uint8Array || data?.type === 'Buffer') {
            const array = data.data
                ? new Uint8Array(data.data)
                : new Uint8Array(data);
            const length_ = array.length;
            const hex = [...array.subarray(0, 10)]
                .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');
            return `[Binary ${length_} bytes] <${hex}${length_ > 10 ? '...' : ''}>`;
        }

        return JSON.stringify(
            data,
            (k, v) => {
                if (Array.isArray(v) && v.length > 20)
                    return `[Array(${v.length})]`;
                if (v instanceof Uint8Array || v?.type === 'Buffer') {
                    return `[Binary ${v.length > 0 || v.data?.length} bytes]`;
                }
                return v;
            },
            2,
        );
    }
    return String(data);
}

export function useRosbagPreview(): {
    isReaderReady: Ref<boolean>;
    readerError: Ref<string | null>;
    topicPreviews: Record<string, any[]>;
    topicLoadingState: Record<string, boolean>;
    init: (url: string) => Promise<void>;
    fetchTopicMessages: (topicName: string) => Promise<void>;
    formatPayload: (data: any) => string;
} {
    const isReaderReady = ref(false);
    const readerError = ref<string | null>(null);
    const topicPreviews = reactive<Record<string, any[]>>({});
    const topicLoadingState = reactive<Record<string, boolean>>({});

    const bagInstance = shallowRef<Bag | null>(null);

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const toNano = (time: { sec: number; nsec: number }): bigint =>
        BigInt(time.sec) * 1_000_000_000n + BigInt(time.nsec);

    async function init(url: string): Promise<void> {
        try {
            readerError.value = null;
            isReaderReady.value = false;
            bagInstance.value = null;

            // 1. PRE-FETCH SIZE (Resolve async size before creating Reader)
            let fileSize = 0;
            let fullBuffer: ArrayBuffer | null = null;

            const response = await fetch(url, {
                headers: { Range: 'bytes=0-0' },
            });

            if (response.status === 200) {
                // Server ignored Range -> Download Full File
                fullBuffer = await response.arrayBuffer();
                fileSize = fullBuffer.byteLength;
            } else if (response.ok) {
                // Server supported Range -> Parse Content-Range
                const rangeHeader = response.headers.get('Content-Range');
                if (rangeHeader) {
                    const match = rangeHeader.match(/\/(\d+)/);
                    if (match) fileSize = Number.parseInt(match[1] ?? '', 10);
                }
                // Fallback to Content-Length
                if (!fileSize) {
                    const length_ = response.headers.get('Content-Length');
                    if (length_) fileSize = Number.parseInt(length_, 10);
                }
            }

            if (!fileSize) {
                // If size is still unknown, force download to get size
                console.warn('[Rosbag] Size unknown. Downloading full file.');
                const fullResponse = await fetch(url);
                fullBuffer = await fullResponse.arrayBuffer();
                fileSize = fullBuffer.byteLength;
            }

            // 2. Initialize Reader with SYNCHRONOUS size
            const reader = new HttpBagReader(url, fileSize, fullBuffer);

            // 3. Initialize Bag
            const bag = new Bag(reader);
            await bag.open();

            bagInstance.value = bag;
            isReaderReady.value = true;
        } catch (error: any) {
            console.error('Failed to init ROSBAG reader:', error);
            readerError.value =
                error instanceof Error ? error.message : String(error);
        }
    }

    async function fetchTopicMessages(topicName: string): Promise<void> {
        if (!bagInstance.value) return;
        topicLoadingState[topicName] = true;

        try {
            const msgs: any[] = [];
            let count = 0;

            const iterator = bagInstance.value.messageIterator({
                topics: [topicName],
            });

            for await (const result of iterator) {
                if (count >= 10) break;
                msgs.push({
                    logTime: toNano(result.timestamp),
                    data: result.message,
                });
                count++;
            }
            topicPreviews[topicName] = msgs;
        } catch (error) {
            console.error(`Error reading topic ${topicName}:`, error);
            topicPreviews[topicName] = [];
        } finally {
            topicLoadingState[topicName] = false;
        }
    }

    return {
        isReaderReady,
        readerError,
        topicPreviews,
        topicLoadingState,
        init,
        fetchTopicMessages,
        formatPayload,
    };
}
