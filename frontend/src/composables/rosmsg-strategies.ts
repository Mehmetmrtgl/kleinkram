import { UniversalHttpReader } from '@common/universal-http-reader';
import { Bag } from '@foxglove/rosbag';
import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import { McapIndexedReader } from '@mcap/core';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';

export interface LogMessage {
    logTime: bigint;
    data: any;
}

export interface LogStrategy {
    init(reader: UniversalHttpReader): Promise<void>;
    getMessages(
        topic: string,
        limit?: number,
        onMessage?: (message: LogMessage) => void,
    ): Promise<LogMessage[]>;
}

// --- MCAP Implementation ---
export class McapStrategy implements LogStrategy {
    private reader: McapIndexedReader | null = null;
    private decoders = new Map<number, any>();

    async init(httpReader: UniversalHttpReader): Promise<void> {
        this.reader = await McapIndexedReader.Initialize({
            readable: httpReader,
            decompressHandlers: {
                zstd: (buffer: Uint8Array) => fzstd.decompress(buffer),
                lz4: (buffer: Uint8Array) => lz4js.decompress(buffer),
                bz2: () => {
                    throw new Error('BZ2 not supported');
                },
            },
        });
    }

    async getMessages(
        topic: string,
        limit = 10,
        onMessage?: (message: LogMessage) => void,
    ): Promise<LogMessage[]> {
        if (!this.reader) return [];
        const msgs: LogMessage[] = [];

        for await (const message of this.reader.readMessages({
            topics: [topic],
        })) {
            if (msgs.length >= limit) break;
            let data = message.data;
            const channel = this.reader.channelsById.get(message.channelId);
            if (channel) {
                data =
                    (await this.tryDecode(channel.schemaId, message.data)) ??
                    message.data;
            }
            const messageObject = { logTime: message.logTime, data };
            if (onMessage) onMessage(messageObject);
            msgs.push(messageObject);
        }
        return msgs;
    }

    private tryDecode(schemaId: number, data: Uint8Array): any {
        if (!this.reader) return;
        let decoder = this.decoders.get(schemaId);
        if (!decoder) {
            const schema = this.reader.schemasById.get(schemaId);
            if (!schema) return;
            try {
                const defs = parseMessageDefer(
                    new TextDecoder().decode(schema.data),
                );
                if (schema.encoding.includes('ros1'))
                    decoder = new Ros1Reader(defs);
                else if (['cdr', 'ros2msg'].includes(schema.encoding))
                    decoder = new CdrReader(defs);
                if (decoder) this.decoders.set(schemaId, decoder);
            } catch {
                return;
            }
        }
        return decoder?.readMessage(data);
    }
}

// --- Rosbag Implementation ---
export class RosbagStrategy implements LogStrategy {
    private bag: Bag | undefined = undefined;

    async init(httpReader: UniversalHttpReader): Promise<void> {
        this.bag = new Bag(
            {
                read: (offset, length): Promise<Uint8Array> =>
                    httpReader.read(BigInt(offset), BigInt(length)),
                size: (): number => httpReader.sizeBytes,
            },
            {
                decompress: {
                    zstd: (buffer): Uint8Array => fzstd.decompress(buffer),
                    lz4: (buffer): Uint8Array => lz4js.decompress(buffer),
                },
            },
        );
        await this.bag.open();
    }

    async getMessages(
        topic: string,
        limit = 10,
        onMessage?: (message: LogMessage) => void,
    ): Promise<LogMessage[]> {
        if (!this.bag) return [];
        const msgs: LogMessage[] = [];
        const iterator = this.bag.messageIterator({ topics: [topic] });
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const toNano = (t: { sec: number; nsec: number }) =>
            BigInt(t.sec) * 1_000_000_000n + BigInt(t.nsec);

        for await (const result of iterator) {
            if (msgs.length >= limit) break;
            const messageObject = {
                logTime: toNano(result.timestamp),
                data: result.message,
            };
            if (onMessage) onMessage(messageObject);
            msgs.push(messageObject);
        }
        return msgs;
    }
}
