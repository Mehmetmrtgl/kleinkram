import { parse as parseMessageDefinition } from '@foxglove/rosmsg';
import { MessageReader as Ros1MessageReader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrMessageReader } from '@foxglove/rosmsg2-serialization';
import { McapIndexedReader } from '@mcap/core';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import * as fzstd from 'fzstd';
import { reactive, ref, shallowRef } from 'vue';

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
            const len = response.headers.get('Content-Length');
            if (len) {
                this.fileSize = BigInt(len);
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

// --- Composable ---
export function useMcapPreview() {
    const isReaderReady = ref(false);
    const readerError = ref<string | null>(null);
    const topicPreviews = reactive<Record<string, any[]>>({});
    const topicLoadingState = reactive<Record<string, boolean>>({});

    // Use shallowRef for complex non-reactive class instances to save performance
    const mcapReaderInstance = shallowRef<McapIndexedReader | null>(null);
    const readerCache = new Map<number, any>();

    async function init(url: string) {
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
        } catch (err: any) {
            console.error('Failed to init MCAP reader:', err);
            readerError.value = `Preview init failed: ${err.message}`;
        }
    }

    async function decodeMessage(
        reader: McapIndexedReader,
        schemaId: number,
        messageData: Uint8Array,
    ) {
        let messageReader = readerCache.get(schemaId);

        if (!messageReader) {
            const schema = reader.schemasById.get(schemaId);
            if (!schema) return `[Missing Schema ID: ${schemaId}]`;

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
                    return undefined;
                }
                readerCache.set(schemaId, messageReader);
            } catch (e: any) {
                return `[Schema Error: ${e.message}]`;
            }
        }
        return messageReader.readMessage(messageData);
    }

    async function fetchTopicMessages(topicName: string) {
        if (!mcapReaderInstance.value) return;
        topicLoadingState[topicName] = true;

        try {
            const iterator = await mcapReaderInstance.value.readMessages({
                topics: [topicName],
            });
            const msgs = [];
            let count = 0;

            for await (const msg of iterator) {
                if (count >= 10) break;
                let decodedData: any = msg.data;
                const channel = mcapReaderInstance.value.channelsById.get(
                    msg.channelId,
                );

                if (channel && channel.schemaId > 0) {
                    try {
                        const res = await decodeMessage(
                            mcapReaderInstance.value,
                            channel.schemaId,
                            msg.data,
                        );
                        if (res !== undefined) decodedData = res;
                    } catch (e) {
                        /* ignore decode fail */
                    }
                }
                msgs.push({ logTime: msg.logTime, data: decodedData });
                count++;
            }
            topicPreviews[topicName] = msgs;
        } catch (err) {
            console.error(`Error reading topic ${topicName}:`, err);
            topicPreviews[topicName] = [];
        } finally {
            topicLoadingState[topicName] = false;
        }
    }

    function formatPayload(data: any): string {
        if (!data) return '[Empty]';
        if (typeof data === 'object' && !(data instanceof Uint8Array)) {
            const json = JSON.stringify(
                data,
                (_, v) =>
                    Array.isArray(v) && v.length > 10
                        ? `[Array(${v.length})]`
                        : v,
                2,
            );
            return json.length > 500 ? json.substring(0, 500) + '...' : json;
        }
        if (data instanceof Uint8Array)
            return `[Binary ${data.byteLength} bytes]`;
        return String(data);
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
