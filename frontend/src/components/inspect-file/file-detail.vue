<template>
    <FileHeader
        :file="file"
        @download="handleDownload"
        @copy-link="copyPublicLink"
        @copy-hash="copyHash"
        @copy-uuid="copyUuid"
    />

    <div class="q-my-lg">
        <div v-if="displayTopics">
            <FileTopicList
                :file="file"
                :is-loading="isLoading"
                :reader-ready="isReaderReady"
                :previews="topicPreviews"
                :loading-state="topicLoadingState"
                :format-payload="formatPayload"
                @load-preview="fetchTopicMessages"
                @redirect-related="redirectToRelated"
            />
        </div>

        <FileHistory :events="events" />

        <div v-if="readerError" class="q-my-md text-negative text-center">
            <q-icon name="sym_o_warning" /> {{ readerError }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { copyToClipboard, Notify } from 'quasar';

// Hooks & Services
import { registerNoPermissionErrorHandler, useFile, useFileEvents } from 'src/hooks/query-hooks';
import { useFileUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { downloadFile } from 'src/services/queries/file';
import { _downloadFile } from 'src/services/generic';
import { useMcapPreview } from 'src/composables/useMcapPreview';
import { FileState } from '@common/enum';

// Subcomponents
import FileHeader from './file-header.vue';
import FileTopicList from './file-topic-list.vue';
import FileHistory from './file-history.vue';

const $router = useRouter();
const fileUuid = useFileUUID();

// --- Data Fetching ---
const { isLoading, data: file, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);
const { data: events } = useFileEvents(fileUuid);

// --- MCAP Logic ---
const {
    isReaderReady,
    readerError,
    topicPreviews,
    topicLoadingState,
    init: initMcap,
    fetchTopicMessages,
    formatPayload
} = useMcapPreview();

const displayTopics = computed(() => file.value?.state === FileState.OK);

// --- Actions ---
const handleDownload = () => _downloadFile(file.value?.uuid ?? '', file.value?.filename ?? '');
const copyHash = () => copyToClipboard(file.value?.hash ?? '');
const copyUuid = () => copyToClipboard(file.value?.uuid ?? '');

async function copyPublicLink() {
    const link = await downloadFile(fileUuid.value ?? '', false);
    await copyToClipboard(link);
    Notify.create({ message: 'Copied: Link valid for 7 days', color: 'positive', timeout: 2000 });
}

async function redirectToRelated() {
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

onMounted(async () => {
    if (!fileUuid.value) return;
    try {
        // Only init MCAP reader if file is OK
        if (file.value?.state !== FileState.OK && file.value?.state !== undefined) return;

        const dynamicUrl = await downloadFile(fileUuid.value, false);
        await initMcap(dynamicUrl);
    } catch (err) {
        console.error('Error setting up preview:', err);
    }
});
</script>