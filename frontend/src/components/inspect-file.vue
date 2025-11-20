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
                        <div
                            class="text-caption text-primary ellipsis"
                            style="font-size: 16px"
                        >
                            {{ file?.mission.project.name }}
                            <q-tooltip>
                                {{ file?.mission.project.name }}</q-tooltip
                            >
                        </div>
                    </div>

                    <div class="col-12 col-md-2">
                        <div class="text-placeholder">Mission</div>
                        <div
                            class="text-caption text-primary ellipsis"
                            style="font-size: 16px"
                        >
                            {{ file?.mission.name }}
                            <q-tooltip> {{ file?.mission.name }}</q-tooltip>
                        </div>
                    </div>

                    <div class="col-12 col-md-3">
                        <div v-if="file?.date">
                            <div class="text-placeholder">Start Date</div>
                            <div
                                class="text-caption text-primary"
                                style="font-size: 16px"
                            >
                                {{ formatDate(file?.date, true) }}
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-md-2">
                        <div v-if="file?.creator">
                            <div class="text-placeholder">Creator</div>
                            <div
                                class="text-caption text-primary ellipsis"
                                style="font-size: 16px"
                            >
                                {{ file?.creator.name }}
                                <q-tooltip> {{ file?.creator.name }}</q-tooltip>
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-md-1">
                        <div class="text-placeholder">File State</div>
                        <q-icon
                            :name="getIcon(file?.state ?? FileState.OK)"
                            :color="
                                getColorFileState(file?.state ?? FileState.OK)
                            "
                            style="font-size: 24px"
                        >
                            <q-tooltip>
                                {{ getTooltip(file?.state) }}
                            </q-tooltip>
                        </q-icon>
                    </div>

                    <div class="col-12 col-md-1">
                        <div class="text-placeholder">Size</div>
                        <div
                            class="text-caption text-primary"
                            style="font-size: 16px"
                        >
                            {{ file?.size ? formatSize(file?.size) : '...' }}
                        </div>
                    </div>
                </div>

                <div class="row items-start">
                    <q-chip
                        v-for="cat in file?.categories"
                        :key="cat.uuid"
                        :label="cat.name"
                        :color="hashUUIDtoColor(cat.uuid)"
                        style="color: white; font-size: smaller"
                    />
                </div>
            </div>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <h2 class="text-h4 q-mb-xs">All Messages</h2>

            <button-group>
                <q-input
                    v-if="displayTopics"
                    v-model="filterKey"
                    debounce="300"
                    placeholder="Search"
                    dense
                    outlined
                >
                    <template #append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <div
                    v-if="
                        file?.state === FileState.OK && !!file.relatedFileUuid
                    "
                    class="flex column"
                >
                    <q-btn
                        :label="`to ${file.type === FileType.BAG ? 'MCAP' : 'BAG'} file`"
                        flat
                        class="button-border full-height"
                        icon="sym_o_note_stack"
                        @click="redirectToMcap"
                    />
                </div>

                <div
                    v-if="file?.state === FileState.OK && !file.relatedFileUuid"
                    class="flex column"
                >
                    <q-btn
                        :label="`Link ${file.type === FileType.BAG ? 'MCAP' : 'BAG'} File`"
                        flat
                        disable
                        class="button-border full-height"
                        icon="sym_o_note_stack_add"
                    >
                        <q-tooltip>
                            This feature is not available yet.
                        </q-tooltip>
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
                flat
                bordered
                separator="none"
                :rows="file?.topics ?? []"
                :columns="columns as any"
                row-key="uuid"
                :loading="isLoading"
                :filter="filterKey"
            >
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
                        <q-item
                            v-for="event in events.data"
                            :key="event.uuid"
                            class="q-py-sm"
                            clickable
                        >
                            <q-item-section
                                avatar
                                style="min-width: 30px; padding-right: 0"
                            >
                                <q-icon
                                    :name="getEventIcon(event.type)"
                                    size="xs"
                                    :color="getEventColor(event.type)"
                                />
                            </q-item-section>

                            <q-item-section>
                                <q-item-label>
                                    {{ formatEventType(event.type) }}
                                    <span
                                        class="text-grey-6 text-caption q-ml-xs"
                                    >
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

                <div
                    v-else
                    class="text-italic text-grey-6 q-pa-sm border-dashed text-center"
                >
                    No file history available.
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { FileEventType, FileState, FileType } from '@common/enum';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import EditFileButton from 'components/buttons/edit-file-button.vue';
import KleinDownloadFile from 'components/cli-links/klein-download-file.vue';
import TitleSection from 'components/title-section.vue';
import { copyToClipboard, Notify, QTable } from 'quasar';
import {
    registerNoPermissionErrorHandler,
    useFile,
    useFileEvents,
} from 'src/hooks/query-hooks';
import { useFileUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import {
    _downloadFile,
    getColorFileState,
    getIcon,
    getTooltip,
    hashUUIDtoColor,
} from 'src/services/generic';
import { downloadFile } from 'src/services/queries/file';
import { computed, Ref, ref } from 'vue';
import { useRouter } from 'vue-router';

const $router = useRouter();

const selected = ref([]);

const filterKey = ref<string>('');
const tableReference: Ref<QTable | undefined> = ref(undefined);

const fileUuid = useFileUUID();
const { isLoading, data: file, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);

const { data: events } = useFileEvents(fileUuid);

function formatEventType(type: FileEventType): string {
    // Map Enum to Human Readable
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
    if (type.includes('COMPLETED') || type.includes('CREATED'))
        return 'sym_o_check_circle';
    if (type.includes('DOWNLOAD')) return 'sym_o_download';
    if (type.includes('UPLOAD')) return 'sym_o_upload';
    if (type.includes('DELETE')) return 'sym_o_delete';
    return 'sym_o_history'; // Default
}

function getEventColor(type: string): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'negative';
    if (type.includes('COMPLETED') || type.includes('CREATED'))
        return 'positive';
    if (type.includes('DELETE')) return 'grey-6';
    return 'primary';
}

const displayTopics = computed(() => {
    if (file.value === undefined) {
        return false;
    }

    return file.value.state === FileState.OK;
});

const columns = [
    {
        name: 'Topic',
        label: 'Topic',
        field: 'name',
        sortable: true,
        align: 'left',
    },
    { name: 'Datatype', label: 'Datatype', field: 'type', sortable: true },
    {
        name: 'NrMessages',
        label: 'NrMessages',
        field: 'nrMessages',
        sortable: true,
    },
    {
        name: 'Frequency',
        label: 'Frequency',
        field: (row: any) => row.frequency || 0,
        sortable: true,
        format: (value: number) => Math.round(value * 100) / 100,
    },
];

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
    Notify.create({
        group: false,
        message: 'Copied: Link valid for 7 days',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 20,
});

const copy = async (): Promise<void> => {
    await copyToClipboard(file.value?.hash ?? '');
};
const download = async (): Promise<void> => {
    await _downloadFile(file.value?.uuid ?? '', file.value?.filename ?? '');
};

const copyDataToClipboard = async (): Promise<void> => {
    await copyToClipboard(file.value?.uuid ?? '');
};
</script>
