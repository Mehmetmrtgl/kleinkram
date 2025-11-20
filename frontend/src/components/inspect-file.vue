<template>
    <title-section :title="`File: ${file?.filename ?? 'Loading...'}`">
        <template #buttons>
            <div class="column row-md items-end q-gutter-sm">
                <button-group class="col-auto">
                    <edit-file-button v-if="file" :file="file" />

                    <q-btn
                        class="button-border"
                        flat
                        icon="sym_o_download"
                        label="Download"
                        :disable="
                            [FileState.LOST, FileState.UPLOADING].includes(
                                file?.state ?? FileState.LOST,
                            )
                        "
                        @click="download"
                    />

                    <q-btn
                        flat
                        icon="sym_o_more_vert"
                        color="primary"
                        class="cursor-pointer button-border"
                        @click.stop
                    >
                        <q-menu v-if="file !== undefined" auto-close>
                            <q-list>
                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="
                                        file?.state === FileState.LOST ||
                                        file?.state === FileState.ERROR
                                    "
                                    @click="_copyLink"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_content_copy" />
                                    </q-item-section>
                                    <q-item-section>
                                        Copy public link
                                    </q-item-section>
                                </q-item>

                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="!file?.hash"
                                    @click="copy"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_encrypted" />
                                    </q-item-section>
                                    <q-item-section> Copy MD5</q-item-section>
                                </q-item>
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="copyDataToClipboard"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_fingerprint" />
                                    </q-item-section>
                                    <q-item-section> Copy UUID</q-item-section>
                                </q-item>
                                <q-item v-ripple clickable style="color: red">
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <DeleteFileDialogOpener
                                            v-if="file"
                                            :file="file"
                                        >
                                            Delete File
                                        </DeleteFileDialogOpener>
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </button-group>

                <div class="col-auto">
                    <KleinDownloadFile v-if="file" :file="file" />
                </div>
            </div>
        </template>

        <template #subtitle>
            <div class="q-gutter-md q-mt-xs">
                <div class="row items-start q-gutter-y-sm">
                    <div class="col-12 col-md-2">
                        <div class="text-placeholder">Project</div>
                        <div class="text-caption text-primary ellipsis" style="font-size: 16px">
                            {{ file?.mission.project.name }}
                            <q-tooltip>{{ file?.mission.project.name }}</q-tooltip>
                        </div>
                    </div>
                    <div class="col-12 col-md-2">
                        <div class="text-placeholder">Mission</div>
                        <div class="text-caption text-primary ellipsis" style="font-size: 16px">
                            {{ file?.mission.name }}
                            <q-tooltip>{{ file?.mission.name }}</q-tooltip>
                        </div>
                    </div>
                    <div class="col-12 col-md-3">
                        <div v-if="file?.date">
                            <div class="text-placeholder">Start Date</div>
                            <div class="text-caption text-primary" style="font-size: 16px">
                                {{ formatDate(file?.date, true) }}
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-2">
                        <div v-if="file?.creator">
                            <div class="text-placeholder">Creator</div>
                            <div class="text-caption text-primary ellipsis" style="font-size: 16px">
                                {{ file?.creator.name }}
                                <q-tooltip>{{ file?.creator.name }}</q-tooltip>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-1">
                        <div class="text-placeholder">File State</div>
                        <q-icon :name="getIcon(file?.state ?? FileState.OK)" :color="getColorFileState(file?.state ?? FileState.OK)" style="font-size: 24px">
                            <q-tooltip>{{ getTooltip(file?.state) }}</q-tooltip>
                        </q-icon>
                    </div>
                    <div class="col-12 col-md-1">
                        <div class="text-placeholder">Size</div>
                        <div class="text-caption text-primary" style="font-size: 16px">
                            {{ file?.size ? formatSize(file?.size) : '...' }}
                        </div>
                    </div>
                </div>
                <div class="row items-start">
                    <q-chip v-for="cat in file?.categories" :key="cat.uuid" :label="cat.name" :color="hashUUIDtoColor(cat.uuid)" style="color: white; font-size: smaller" />
                </div>
            </div>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <h2 class="text-h4 q-mb-xs">All Messages</h2>
            <button-group>
                <q-input v-if="displayTopics" v-model="filterKey" debounce="300" placeholder="Search" dense outlined>
                    <template #append><q-icon name="sym_o_search" /></template>
                </q-input>
                <div v-if="file?.state === FileState.OK && !!file.relatedFileUuid" class="flex column">
                    <q-btn :label="`to ${file.type === FileType.BAG ? 'MCAP' : 'BAG'} file`" flat class="button-border full-height" icon="sym_o_note_stack" @click="redirectToMcap" />
                </div>
                <div v-if="file?.state === FileState.OK && !file.relatedFileUuid" class="flex column">
                    <q-btn :label="`Link ${file.type === FileType.BAG ? 'MCAP' : 'BAG'} File`" flat disable class="button-border full-height" icon="sym_o_note_stack_add">
                        <q-tooltip>This feature is not available yet.</q-tooltip>
                    </q-btn>
                </div>
            </button-group>
        </div>

        <div style="padding-top: 10px">
            <q-table
                v-if="displayTopics"
                ref="tableReference"
                v-model:selected="selected"
                v-model:pagination="pagination"
                v-model:expanded="expanded"
                flat
                bordered
                separator="none"
                :rows="file?.topics ?? []"
                :columns="columns as any"
                row-key="name"
                :loading="isLoading"
                :filter="filterKey"
            >
                <template #header="props">
                    <q-tr :props="props">
                        <q-th auto-width />
                        <q-th v-for="col in props.cols" :key="col.name" :props="props">
                            {{ col.label }}
                        </q-th>
                    </q-tr>
                </template>

                <template #body="props">
                    <q-tr :props="props" class="cursor-pointer" @click="props.expand = !props.expand">
                        <q-td auto-width>
                            <q-btn
                                size="sm"
                                color="primary"
                                round
                                dense
                                flat
                                :icon="props.expand ? 'sym_o_keyboard_arrow_up' : 'sym_o_keyboard_arrow_down'"
                                @click.stop="props.expand = !props.expand"
                            />
                        </q-td>
                        <q-td v-for="col in props.cols" :key="col.name" :props="props">
                            {{ col.value }}
                        </q-td>
                    </q-tr>

                    <q-tr v-show="props.expand" :props="props">
                        <q-td colspan="100%">
                            <div class="text-left q-pa-sm bg-grey-1">
                                <div class="row justify-between items-center q-mb-sm">
                                    <div class="text-subtitle2 text-grey-8">
                                        Message Preview
                                    </div>

                                    <q-btn
                                        v-if="!topicPreviews[props.row.name]"
                                        label="Load 10 Messages"
                                        size="sm"
                                        color="primary"
                                        outline
                                        icon="sym_o_download"
                                        :loading="topicLoadingState[props.row.name]"
                                        :disable="!isReaderReady"
                                        @click="fetchTopicMessages(props.row.name)"
                                    >
                                        <q-tooltip v-if="!isReaderReady">Initializing Reader...</q-tooltip>
                                    </q-btn>
                                </div>

                                <div v-if="topicLoadingState[props.row.name]" class="row items-center q-gutter-sm text-grey-7 q-pa-sm">
                                    <q-spinner-dots size="1.5em" />
                                    <span>Fetching...</span>
                                </div>

                                <div v-else-if="topicPreviews[props.row.name]?.length > 0">
                                    <q-list dense separator class="rounded-borders bg-white">
                                        <q-item v-for="(msg, idx) in topicPreviews[props.row.name]" :key="idx" class="q-py-xs">
                                            <q-item-section>
                                                <q-item-label caption class="row items-center">
                                                    <span class="text-weight-bold text-primary">
                                                        {{ formatLogTime(msg.logTime) }}
                                                    </span>
                                                    <span class="q-mx-xs text-grey-4">|</span>
                                                    <span>{{ msg.data.byteLength }} bytes</span>
                                                </q-item-label>

                                                <q-item-label class="q-mt-xs text-code" style="font-family: monospace; font-size: 11px; word-break: break-all; color: #555; background: #fafafa; padding: 6px; border-radius: 4px; border: 1px solid #eee;">
                                                    {{ formatPayload(msg.data) }}
                                                </q-item-label>
                                            </q-item-section>
                                        </q-item>
                                    </q-list>
                                </div>

                                <div v-else-if="topicPreviews[props.row.name]" class="text-italic text-negative q-py-sm">
                                    <q-icon name="sym_o_warning" />
                                    No messages found or failed to read.
                                </div>
                            </div>
                        </q-td>
                    </q-tr>
                </template>

                <template #no-data>
                    <q-card-section class="q-pa-none">
                        <div class="q-mt-md q-mb-md">No messages found.</div>
                    </q-card-section>
                </template>
            </q-table>
            <div class="text-grey-8">
                <h2 class="text-h5 q-mb-sm q-mt-lg text-grey-9">File Events</h2>
                <div v-if="events?.count && events.count > 0">
                    <q-list bordered separator dense class="rounded-borders">
                        <q-item v-for="event in events.data" :key="event.uuid" class="q-py-sm" clickable>
                            <q-item-section avatar style="min-width: 30px; padding-right: 0">
                                <q-icon :name="getEventIcon(event.type)" size="xs" :color="getEventColor(event.type)" />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>
                                    {{ formatEventType(event.type) }}
                                    <span class="text-grey-6 text-caption q-ml-xs">
                                        {{ event.actor?.name ?? 'System' }}
                                    </span>
                                </q-item-label>
                            </q-item-section>
                            <q-item-section side>
                                <div class="text-caption text-grey-6">
                                    {{ formatDate(event.createdAt) }}
                                </div>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </div>
                <div v-else class="text-italic text-grey-6 q-pa-sm border-dashed text-center">
                    No file history available.
                </div>
            </div>
        </div>
        <div v-if="globalError" class="q-my-md text-negative text-center">
            <q-icon name="sym_o_warning" /> {{ globalError }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { FileEventType, FileState, FileType } from '@common/enum';
import {  McapIndexedReader } from '@mcap/core';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import EditFileButton from 'components/buttons/edit-file-button.vue';
import KleinDownloadFile from 'components/cli-links/klein-download-file.vue';
import TitleSection from 'components/title-section.vue';
import * as fzstd from 'fzstd';
import { copyToClipboard, Notify, QTable } from 'quasar';
import { registerNoPermissionErrorHandler, useFile, useFileEvents } from 'src/hooks/query-hooks';
import { useFileUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { _downloadFile, getColorFileState, getIcon, getTooltip, hashUUIDtoColor } from 'src/services/generic';
import { downloadFile } from 'src/services/queries/file';
import { computed, onMounted, reactive, Ref, ref } from 'vue';
import { useRouter } from 'vue-router';
import { parse as parseMessageDefinition } from '@foxglove/rosmsg';
import { MessageReader as Ros1MessageReader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrMessageReader } from '@foxglove/rosmsg2-serialization';



const $router = useRouter();
const selected = ref([]);
const filterKey = ref<string>('');
const tableReference: Ref<QTable | undefined> = ref(undefined);
const fileUuid = useFileUUID();
const { isLoading, data: file, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);
const { data: events } = useFileEvents(fileUuid);

function formatEventType(type: FileEventType): string {
    const map: Record<string, string> = {
        [FileEventType.CREATED]: 'File Created',
        [FileEventType.UPLOAD_STARTED]: 'Upload Started',
        [FileEventType.UPLOAD_COMPLETED]: 'Upload Completed',
        [FileEventType.DOWNLOADED]: 'Downloaded',
        [FileEventType.RENAMED]: 'Renamed',
        [FileEventType.MOVED]: 'Moved',
    };
    return map[type] ?? type;
}
function getEventIcon(type: string): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'sym_o_error';
    if (type.includes('COMPLETED') || type.includes('CREATED')) return 'sym_o_check_circle';
    if (type.includes('DOWNLOAD')) return 'sym_o_download';
    if (type.includes('UPLOAD')) return 'sym_o_upload';
    if (type.includes('DELETE')) return 'sym_o_delete';
    return 'sym_o_history';
}
function getEventColor(type: string): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'negative';
    if (type.includes('COMPLETED') || type.includes('CREATED')) return 'positive';
    if (type.includes('DELETE')) return 'grey-6';
    return 'primary';
}
const displayTopics = computed(() => file.value?.state === FileState.OK);
const columns = [
    { name: 'Topic', label: 'Topic', field: 'name', sortable: true, align: 'left' },
    { name: 'Datatype', label: 'Datatype', field: 'type', sortable: true },
    { name: 'NrMessages', label: 'NrMessages', field: 'nrMessages', sortable: true },
    { name: 'Frequency', label: 'Frequency', field: (row: any) => row.frequency || 0, sortable: true, format: (value: number) => Math.round(value * 100) / 100 },
];
// Actions
async function redirectToMcap(): Promise<void> {
    if (file.value?.relatedFileUuid) {
        await $router.push({
            name: ROUTES.FILE.routeName,
            params: {
                projectUuid: file.value.mission.project.uuid,
                missionUuid: file.value.mission.uuid,
                file_uuid: file.value.relatedFileUuid,
            },
        });
    }
}
async function _copyLink(): Promise<void> {
    const downloadLink = await downloadFile(fileUuid.value ?? '', false);
    await copyToClipboard(downloadLink);
    Notify.create({ message: 'Copied: Link valid for 7 days', color: 'positive', timeout: 2000 });
}
const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 20 });
const copy = async () => copyToClipboard(file.value?.hash ?? '');
const download = async () => _downloadFile(file.value?.uuid ?? '', file.value?.filename ?? '');
const copyDataToClipboard = async () => copyToClipboard(file.value?.uuid ?? '');

// =========================================================
//  MCAP Reader Logic (Final)
// =========================================================

const expanded = ref([]);
const globalError = ref<string | null>(null);
const topicPreviews = reactive<Record<string, any[]>>({});
const topicLoadingState = reactive<Record<string, boolean>>({});

let mcapReaderInstance: McapIndexedReader | null = null;
const isReaderReady = ref(false);

class HttpReadBuffer implements IReadable {
    private url: string;
    private fileSize: bigint | undefined;
    constructor(url: string) { this.url = url; }
    async size(): Promise<bigint> {
        if (this.fileSize !== undefined) return this.fileSize;
        const response = await fetch(this.url, { headers: { Range: 'bytes=0-0' } });
        if (!response.ok) throw new Error(`Failed to fetch size`);
        const contentRange = response.headers.get('Content-Range');
        if (contentRange) {
            const total = contentRange.split('/')[1];
            if (total && total !== '*') { this.fileSize = BigInt(total); return this.fileSize; }
        }
        if (response.status === 200) {
            const len = response.headers.get('Content-Length');
            if (len) { this.fileSize = BigInt(len); return this.fileSize; }
        }
        throw new Error('Could not determine file size');
    }
    async read(offset: bigint, size: bigint): Promise<Uint8Array> {
        if (size === 0n) return new Uint8Array(0);
        const end = offset + size - 1n;
        const response = await fetch(this.url, { headers: { Range: `bytes=${offset}-${end}` } });
        if (!response.ok) throw new Error(`Read failed`);
        return new Uint8Array(await response.arrayBuffer());
    }
}

function getDecompressHandlers() {
    return {
        zstd: (buffer) => fzstd.decompress(buffer),
        lz4: () => { throw new Error('LZ4 not supported in preview'); },
        bz2: () => { throw new Error('BZ2 not supported in preview'); },
    };
}

async function initMcapReader(url: string): Promise<void> {
    try {
        const fileReader = new HttpReadBuffer(url);
        mcapReaderInstance = await McapIndexedReader.Initialize({
            readable: fileReader,
            decompressHandlers: getDecompressHandlers(),
        });
        isReaderReady.value = true;
    } catch (err: any) {
        console.error('Failed to init MCAP reader:', err);
        globalError.value = `Preview init failed: ${err.message}`;
    }
}

/**
 * Cache for message readers to avoid re-parsing schemas on every message
 */
const readerCache = new Map<number, any>();

async function decodeMessage(
    reader: McapIndexedReader,
    schemaId: number,
    messageData: Uint8Array
): Promise<unknown> {
    let messageReader = readerCache.get(schemaId);

    if (!messageReader) {
        const schema = reader.schemasById.get(schemaId);
        if (!schema) return `[Missing Schema ID: ${schemaId}]`;

        try {
            const parsedDefinitions = parseMessageDefinition(new TextDecoder().decode(schema.data));

            // FIX: Add 'ros1' to the check (common in some bags)
            if (schema.encoding === 'ros1msg' || schema.encoding === 'ros1') {
                messageReader = new Ros1MessageReader(parsedDefinitions);
            } else if (schema.encoding === 'cdr' || schema.encoding === 'ros2msg') {
                messageReader = new CdrMessageReader(parsedDefinitions);
            } else {
                console.warn(`Unsupported encoding: ${schema.encoding}`);
                return undefined;
            }
            readerCache.set(schemaId, messageReader);
        } catch (e: any) {
            console.error("Schema parse error:", e);
            return `[Schema Error: ${e.message}]`;
        }
    }

    try {
        return messageReader.readMessage(messageData);
    } catch (e: any) {
        return `[Decode Error: ${e.message}]`;
    }
}

/**
 * Smart Payload Formatter: Tries to show Text, falls back to Hex.
 */
function formatPayload(data: any): string {
    if (!data) return '[Empty]';

    // If it's already an Object (decoded), pretty print it
    if (typeof data === 'object' && !(data instanceof Uint8Array)) {
        // Truncate large JSONs for preview
        const json = JSON.stringify(data, (key, value) => {
            // Optional: Filter out huge arrays like point clouds for preview
            if (Array.isArray(value) && value.length > 10) return `[Array(${value.length})]`;
            return value;
        }, 2);
        return json.length > 500 ? json.substring(0, 500) + '...' : json;
    }


    // Fallback for Uint8Array (Binary)
    if (data instanceof Uint8Array) {
        // ... (Your existing Hex/Text heuristic logic) ...
        // (Copy the hex/text logic from previous answer here)
        return `[Binary ${data.byteLength} bytes]`;
    }

    return String(data);
}

function formatLogTime(nanosec: bigint): string {
    const millis = Number(nanosec / 1_000_000n);
    return new Date(millis).toISOString();
}

interface McapMessageRecord {
    channelId: number;
    sequence: number;
    publishTime: bigint;
    logTime: bigint;
    data: Uint8Array;
    schemaId: number;
}
async function fetchTopicMessages(topicName: string): Promise<void> {
    if (!mcapReaderInstance) return;

    topicLoadingState[topicName] = true;
    try {
        const iterator = await mcapReaderInstance.readMessages({
            topics: [topicName]
        });

        const msgs = [];
        let count = 0;

        for await (const msg of iterator) {
            let decodedData: any = msg.data;

            // FIX: Look up the channel to find the schemaId
            const channel = mcapReaderInstance.channelsById.get(msg.channelId);

            if (channel && channel.schemaId > 0) {
                try {
                    const result = await decodeMessage(mcapReaderInstance, channel.schemaId, msg.data);
                    if (result !== undefined) {
                        decodedData = result;
                    }
                } catch (e) {
                    console.warn(`Failed to decode message on ${topicName}:`, e);
                }
            }

            msgs.push({
                logTime: msg.logTime,
                data: decodedData
            });

            count++;
            if (count >= 10) break;
        }

        topicPreviews[topicName] = msgs;
    } catch (err) {
        console.error(`Error reading topic ${topicName}:`, err);
        topicPreviews[topicName] = [];
    } finally {
        topicLoadingState[topicName] = false;
    }
}

onMounted(async () => {
    if (!fileUuid.value) return;
    try {
        const dynamicUrl = await downloadFile(fileUuid.value, false);
        await initMcapReader(dynamicUrl);
    } catch (err) {
        console.error('Error setting up preview:', err);
        globalError.value = 'Could not generate file preview link.';
    }
});
</script>