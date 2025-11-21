import { parse as parseMessageDefinition } from '@foxglove/rosmsg';
import { MessageReader as Ros1MessageReader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrMessageReader } from '@foxglove/rosmsg2-serialization';
import { McapIndexedReader } from '@mcap/core';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import * as fzstd from 'fzstd';
import { reactive, Ref, ref, shallowRef } from 'vue';

class HttpReadBuffer implements IReadable {
    private url: string;
    private fileSize: bigint | undefined;
    constructor(url: string) {
        this.url = url;
    }

    async size(): Promise<bigint> {
        if (this.fileSize !== undefined) return this.fileSize;
        const response = await fetch(this.url, {
            headers: { Range: 'bytes=0-0' },
        });
        if (!response.ok) throw new Error(`Failed to fetch size`);

        const contentRange = response.headers.get('Content-Range');
        if (contentRange) {
            const total = contentRange.split('/')[1];
            if (total && total !== '*') {
                this.fileSize = BigInt(total);
                return this.fileSize;
            }
        }
        if (response.status === 200) {
            const length_ = response.headers.get('Content-Length');
            if (length_) {
                this.fileSize = BigInt(length_);
                return this.fileSize;
            }
        }
        throw new Error('Could not determine file size');
    }

    async read(offset: bigint, size: bigint): Promise<Uint8Array> {
        if (size === 0n) return new Uint8Array(0);
        const end = offset + size - 1n;
        const response = await fetch(this.url, {
            headers: { Range: `bytes=${offset}-${end}` },
        });
        if (!response.ok) throw new Error(`Read failed`);
        return new Uint8Array(await response.arrayBuffer());
    }
}

function formatPayload(data: any): string {
    if (!data) return '[Empty]';

    // 1. Handle Decoded Objects (JSON)
    if (typeof data === 'object' && !(data instanceof Uint8Array)) {
        const json = JSON.stringify(
            data,
            (_, v) =>
                Array.isArray(v) && v.length > 10 ? `[Array(${v.length})]` : v,
            2,
        );
        return json.length > 500 ? `${json.slice(0, 500)}...` : json;
    }

    // 2. Handle Binary Data (Uint8Array) with Hex Preview
    if (data instanceof Uint8Array) {
        const maxBytes = 12; // Number of bytes to preview
        const hex = [...data.subarray(0, maxBytes)]
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

        const suffix = data.length > maxBytes ? '...' : '';
        return `[Binary ${data.byteLength} bytes] <${hex}${suffix}>`;
    }

    return String(data);
}

// --- Composable ---
export function useMcapPreview(): {
    isReaderReady: Ref<boolean, boolean>;
    readerError: Ref<string | null, string | null>;
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

    // Use shallowRef for complex non-reactive class instances to save performance
    const mcapReaderInstance = shallowRef<McapIndexedReader | null>(null);
    const readerCache = new Map<number, any>();

    async function init(url: string): Promise<void> {
        try {
            const fileReader = new HttpReadBuffer(url);
            mcapReaderInstance.value = await McapIndexedReader.Initialize({
                readable: fileReader,
                decompressHandlers: {
                    zstd: (buffer) => fzstd.decompress(buffer),
                    lz4: () => {
                        throw new Error('LZ4 not supported in preview');
                    },
                    bz2: () => {
                        throw new Error('BZ2 not supported in preview');
                    },
                },
            });
            isReaderReady.value = true;
        } catch (error: any) {
            console.error('Failed to init MCAP reader:', error);
            readerError.value = `Preview init failed: ${error.message}`;
        }
    }

    async function decodeMessage(
        reader: McapIndexedReader,
        schemaId: number,
        messageData: Uint8Array,
    ): Promise<any> {
        let messageReader = readerCache.get(schemaId);

        if (!messageReader) {
            const schema = reader.schemasById.get(schemaId);
            // Return undefined to fallback to binary view if schema is missing
            if (!schema) return;

            try {
                const parsedDefinitions = parseMessageDefinition(
                    new TextDecoder().decode(schema.data),
                );
                if (
                    schema.encoding === 'ros1msg' ||
                    schema.encoding === 'ros1'
                ) {
                    messageReader = new Ros1MessageReader(parsedDefinitions);
                } else if (['cdr', 'ros2msg'].includes(schema.encoding)) {
                    messageReader = new CdrMessageReader(parsedDefinitions);
                } else {
                    return;
                }
                readerCache.set(schemaId, messageReader);
            } catch {
                return;
            }
        }

        // Safety check if reader creation failed silently
        if (!messageReader) return;

        try {
            return messageReader.readMessage(messageData);
        } catch {
            return;
        }
    }

    async function fetchTopicMessages(topicName: string): Promise<void> {
        if (!mcapReaderInstance.value) return;
        topicLoadingState[topicName] = true;

        try {
            const iterator = mcapReaderInstance.value.readMessages({
                topics: [topicName],
            });
            const msgs = [];
            let count = 0;

            for await (const message of iterator) {
                if (count >= 10) break;
                let decodedData: any = message.data;
                const channel = mcapReaderInstance.value.channelsById.get(
                    message.channelId,
                );

                if (channel && channel.schemaId > 0) {
                    try {
                        const result = await decodeMessage(
                            mcapReaderInstance.value,
                            channel.schemaId,
                            message.data,
                        );
                        if (result !== undefined) decodedData = result;
                    } catch {
                        /* ignore decode fail */
                    }
                }
                msgs.push({ logTime: message.logTime, data: decodedData });
                count++;
            }
            topicPreviews[topicName] = msgs;
        } catch (error: unknown) {
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
