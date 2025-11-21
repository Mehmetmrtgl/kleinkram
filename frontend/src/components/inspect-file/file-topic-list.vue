<template>
    <div class="flex justify-between items-center q-mb-md">
        <h2 class="text-h4 q-my-none">All Messages</h2>
        <button-group>
            <q-input
                v-model="filterKey"
                debounce="300"
                placeholder="Search"
                dense
                outlined
            >
                <template #append><q-icon name="sym_o_search" /></template>
            </q-input>

            <div class="flex column">
                <q-btn
                    v-if="file?.relatedFileUuid"
                    :label="`to ${file.type === FileType.BAG ? 'MCAP' : 'BAG'} file`"
                    flat
                    class="button-border full-height"
                    icon="sym_o_note_stack"
                    @click="goToRelatedFile"
                />
                <q-btn
                    v-else
                    :label="`Link ${file?.type === FileType.BAG ? 'MCAP' : 'BAG'} File`"
                    flat
                    disable
                    class="button-border full-height"
                    icon="sym_o_note_stack_add"
                >
                    <q-tooltip>This feature is not available yet.</q-tooltip>
                </q-btn>
            </div>
        </button-group>
    </div>

    <q-table
        :rows="file?.topics ?? []"
        :columns="columns"
        :loading="isLoading"
        :filter="filterKey"
        flat
        bordered
        separator="none"
        row-key="name"
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
            <q-tr
                :props="props"
                class="cursor-pointer"
                @click="() => (props.expand = !props.expand)"
            >
                <q-td auto-width>
                    <q-btn
                        size="sm"
                        color="primary"
                        round
                        dense
                        flat
                        :icon="
                            props.expand
                                ? 'sym_o_keyboard_arrow_up'
                                : 'sym_o_keyboard_arrow_down'
                        "
                        @click.stop="() => (props.expand = !props.expand)"
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
                                <q-badge
                                    align="top"
                                    color="warning"
                                    text-color="dark"
                                    label="BETA"
                                    class="q-ml-xs"
                                    style="font-size: 8px; padding: 2px 4px"
                                />
                            </div>
                            <q-btn
                                v-if="!previews[props.row.name]"
                                label="Load 10 Messages"
                                size="sm"
                                color="primary"
                                outline
                                icon="sym_o_download"
                                :loading="loadingState[props.row.name]"
                                :disable="!readerReady"
                                @click="
                                    () => emit('load-preview', props.row.name)
                                "
                            >
                                <q-tooltip v-if="!readerReady">
                                    Initializing Reader...
                                </q-tooltip>
                            </q-btn>
                        </div>

                        <div
                            v-if="loadingState[props.row.name]"
                            class="row items-center q-gutter-sm text-grey-7 q-pa-sm"
                        >
                            <q-spinner-dots size="1.5em" />
                            <span>Fetching...</span>
                        </div>

                        <div
                            v-else-if="topicErrors[props.row.name]"
                            class="text-negative q-pa-sm bg-red-1 rounded-borders"
                        >
                            <q-icon name="sym_o_error" class="q-mr-xs" />
                            Failed to load: {{ topicErrors[props.row.name] }}
                        </div>

                        <div
                            v-else-if="
                                (previews?.[props.row.name]?.length ?? 0) > 0
                            "
                        >
                            <q-list separator class="rounded-borders bg-white">
                                <q-item
                                    v-for="(msg, idx) in previews[
                                        props.row.name
                                    ]"
                                    :key="idx"
                                    class="q-py-md"
                                >
                                    <q-item-section>
                                        <q-item-label
                                            caption
                                            class="row items-center q-mb-xs"
                                        >
                                            <span
                                                class="text-weight-bold text-primary"
                                            >
                                                {{ formatLogTime(msg.logTime) }}
                                            </span>
                                            <span class="q-mx-xs text-grey-4"
                                                >|</span
                                            >
                                            <span
                                                >{{
                                                    getByteLength(msg.data)
                                                }}
                                                bytes</span
                                            >
                                        </q-item-label>

                                        <div
                                            v-if="isJpegImage(msg.data)"
                                            class="q-mt-xs q-pa-sm bg-grey-2 rounded-borders"
                                            style="width: fit-content"
                                        >
                                            <img
                                                :src="getJpegSource(msg.data)"
                                                style="
                                                    max-width: 100%;
                                                    max-height: 300px;
                                                    display: block;
                                                "
                                            />
                                            <div
                                                class="text-caption text-grey-7 q-mt-xs"
                                            >
                                                Format: {{ msg.data.format }}
                                            </div>
                                        </div>

                                        <q-item-label
                                            v-else
                                            class="q-mt-xs text-code preview-code"
                                            style="
                                                white-space: pre-wrap;
                                                font-family: monospace;
                                                word-break: break-all;
                                            "
                                        >
                                            {{ formatPayload(msg.data) }}
                                        </q-item-label>
                                    </q-item-section>
                                </q-item>
                            </q-list>

                            <div
                                v-if="
                                    props.row.nrMessages >
                                    (previews[props.row.name]?.length ?? 0)
                                "
                                class="text-center q-pa-md text-grey-7 text-caption"
                            >
                                <q-icon name="sym_o_more_horiz" size="sm" />
                                <div class="q-mt-xs">
                                    +{{
                                        props.row.nrMessages -
                                        (previews[props.row.name]?.length ?? 0)
                                    }}
                                    more messages in file
                                </div>
                            </div>
                        </div>

                        <div
                            v-else-if="previews[props.row.name]"
                            class="text-italic text-grey q-py-sm"
                        >
                            No messages found.
                        </div>
                    </div>
                </q-td>
            </q-tr>
        </template>

        <template #no-data>
            <q-card-section class="q-pa-none">
                <div class="q-my-md">No messages found.</div>
            </q-card-section>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import { FileType } from '@common/enum';
import ButtonGroup from 'components/buttons/button-group.vue';
import { QTableColumn } from 'quasar';
import { ref } from 'vue';

defineProps<{
    file: any;
    isLoading: boolean;
    readerReady: boolean;
    previews: Record<string, any[]>;
    loadingState: Record<string, boolean>;
    formatPayload: (data: any) => string;
    topicErrors: Record<string, string | null>;
}>();

const emit = defineEmits(['load-preview', 'redirect-related']);
const filterKey = ref('');

const columns: QTableColumn[] = [
    {
        name: 'Topic',
        label: 'Topic',
        field: 'name',
        sortable: true,
        align: 'left',
    },
    {
        name: 'Datatype',
        label: 'Datatype',
        field: 'type',
        sortable: true,
        align: 'left',
    },
    {
        name: 'NrMessages',
        label: 'NrMessages',
        field: 'nrMessages',
        sortable: true,
        align: 'left',
    },
    {
        name: 'Frequency',
        label: 'Frequency',
        field: (row: any) => row.frequency || 0,
        sortable: true,
        format: (value: number) =>
            value === 0 ? 'N/A' : String(Math.round(value * 100) / 100),
        align: 'left',
    },
];

function formatLogTime(nanosec: bigint): string {
    const millis = Number(nanosec / 1_000_000n);
    return new Date(millis).toISOString();
}

function getByteLength(data: any): number {
    if (data instanceof Uint8Array) return data.byteLength;
    if (data?.data && typeof data.data === 'object')
        return Object.keys(data.data).length;
    return 0;
}

function isJpegImage(messageData: any): boolean {
    if (!messageData) return false;
    const hasFormat =
        messageData.format && typeof messageData.format === 'string';
    const isJpeg =
        hasFormat && messageData.format.toLowerCase().includes('jpeg');
    const hasData = messageData.data !== undefined;
    return isJpeg && hasData;
}

function getJpegSource(messageData: any): string {
    try {
        let bytes: Uint8Array | null = null;
        const rawData = messageData.data;

        if (rawData instanceof Uint8Array) {
            bytes = rawData;
        } else if (Array.isArray(rawData)) {
            bytes = new Uint8Array(rawData);
        } else if (typeof rawData === 'object') {
            const keys = Object.keys(rawData)
                .map(Number)
                .sort((a, b) => a - b);
            bytes = new Uint8Array(keys.length);
            for (const [index, key] of keys.entries()) {
                bytes[index] = rawData[key];
            }
        }

        if (!bytes) return '';

        let binary = '';
        const length_ = bytes.byteLength;
        for (let index = 0; index < length_; index++) {
            binary += String.fromCodePoint(bytes[index] ?? 0);
        }

        return `data:image/jpeg;base64,${globalThis.btoa(binary)}`;
    } catch (error) {
        console.error('Failed to render JPEG preview', error);
        return '';
    }
}

const goToRelatedFile = (): void => {
    emit('redirect-related');
};
</script>

<style scoped>
.button-border {
    border: 1px solid #ddd;
}
.preview-code {
    font-family: monospace;
    font-size: 11px;
    word-break: break-all;
    color: #555;
    background: #fafafa;
    padding: 6px;
    border-radius: 4px;
    border: 1px solid #eee;
}
</style>
