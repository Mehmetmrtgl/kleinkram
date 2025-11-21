<template>
    <FileHeader
        v-if="file"
        :file="file"
        @download="handleDownload"
        @copy-link="copyPublicLink"
        @copy-hash="copyHash"
        @copy-uuid="copyUuid"
    />

    <div class="q-my-lg" v-if="file">
        <div v-if="displayTopics && activeReader">
            <FileTopicList
                :file="file"
                :is-loading="isLoading"
                :reader-ready="activeReader.isReaderReady.value"
                :previews="activeReader.topicPreviews"
                :loading-state="activeReader.topicLoadingState"
                :format-payload="activeReader.formatPayload"
                @load-preview="activeReader.fetchTopicMessages"
                @redirect-related="redirectToRelated"
            />
        </div>

        <FileHistory :events="events" />

        <div
            v-if="activeReader?.readerError.value"
            class="q-my-md text-negative text-center"
        >
            <q-icon name="sym_o_warning" />
            {{ activeReader.readerError.value }}
        </div>
    </div>

    <div v-else class="text-center q-pa-md">
        <q-spinner size="3em" color="primary" />
        <div class="text-grey q-mt-sm">Loading file details...</div>
    </div>
</template>

<script setup lang="ts">
import { copyToClipboard, Notify } from 'quasar';
import { computed, watch } from 'vue'; // Changed onMounted to watch
import { useRouter } from 'vue-router';

// Hooks & Services
import { FileState, FileType } from '@common/enum';
import { useMcapPreview } from 'src/composables/use-mcap-preview';
import { useRosbagPreview } from 'src/composables/use-rosbag-preview';
import {
    registerNoPermissionErrorHandler,
    useFile,
    useFileEvents,
} from 'src/hooks/query-hooks';
import { useFileUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { _downloadFile } from 'src/services/generic';
import { downloadFile } from 'src/services/queries/file';

// Subcomponents
import FileHeader from './file-header.vue';
import FileHistory from './file-history.vue';
import FileTopicList from './file-topic-list.vue';

const $router = useRouter();
const fileUuid = useFileUUID();

// --- Data Fetching ---
const { isLoading, data: file, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);
const { data: events } = useFileEvents(fileUuid);

// --- Preview Logic ---
const mcapPreview = useMcapPreview();
const rosbagPreview = useRosbagPreview();

// 1. Computed Reader Selector
// Returns NULL if the file isn't loaded yet, preventing early initialization.
const activeReader = computed(() => {
    if (!file.value) return null;

    if (file.value.type === FileType.BAG) {
        return rosbagPreview;
    }
    // Default to MCAP only if we are sure it's not a BAG
    return mcapPreview;
});

const displayTopics = computed(() => file.value?.state === FileState.OK);

// --- Initialization Logic ---
// 2. Use `watch` instead of `onMounted`.
// This waits for 'file' to be populated from the API before doing anything.
watch(
    () => [file.value, activeReader.value] as const,
    async ([currentFile, currentReader]) => {
        // Guard clauses:
        // - File must exist
        // - Reader must be selected
        // - File state must be OK
        // - Reader shouldn't already be ready (prevent double init)
        if (
            !currentFile ||
            !currentReader ||
            currentFile.state !== FileState.OK ||
            currentReader.isReaderReady.value
        ) {
            return;
        }

        try {
            console.log(`Initializing preview for ${currentFile.type}...`);
            const dynamicUrl = await downloadFile(
                currentFile.uuid,
                false,
                true,
            );
            await currentReader.init(dynamicUrl);
        } catch (e) {
            console.error('Error setting up preview:', e);
        }
    },
    { immediate: true },
);

// --- Actions ---
const handleDownload = (): Promise<void> =>
    _downloadFile(file.value?.uuid ?? '', file.value?.filename ?? '');
const copyHash = (): Promise<void> => copyToClipboard(file.value?.hash ?? '');
const copyUuid = (): Promise<void> => copyToClipboard(file.value?.uuid ?? '');

async function copyPublicLink(): Promise<void> {
    if (!fileUuid.value) return;
    const link = await downloadFile(fileUuid.value, false);
    await copyToClipboard(link);
    Notify.create({
        message: 'Copied: Link valid for 7 days',
        color: 'positive',
        timeout: 2000,
    });
}

async function redirectToRelated(): Promise<void> {
    if (!file.value?.relatedFileUuid) return;
    await $router.push({
        name: ROUTES.FILE.routeName,
        params: {
            projectUuid: file.value.mission.project.uuid,
            missionUuid: file.value.mission.uuid,
            file_uuid: file.value.relatedFileUuid,
        },
    });
}
</script>
