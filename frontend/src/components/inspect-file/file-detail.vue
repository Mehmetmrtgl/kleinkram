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
        <div v-if="isYaml" class="q-mb-lg">
            <h2 class="text-h4 q-mb-md">Content Preview</h2>
            <div
                v-if="yamlContent"
                class="bg-grey-1 q-pa-md rounded-borders border-solid"
            >
                <pre class="q-ma-none text-code" style="overflow-x: auto">{{
                    yamlContent
                }}</pre>
            </div>
            <div v-else class="row items-center q-gutter-sm text-grey-7">
                <q-spinner-dots size="1.5em" />
                <span>Loading YAML content...</span>
            </div>
        </div>

        <div v-if="displayTopics && preview.isReaderReady.value">
            <FileTopicList
                :file="file"
                :is-loading="isLoading"
                :reader-ready="preview.isReaderReady.value"
                :previews="preview.topicPreviews"
                :loading-state="preview.topicLoadingState"
                :topic-errors="preview.topicErrors"
                :format-payload="preview.formatPayload"
                @load-preview="preview.fetchTopicMessages"
                @redirect-related="redirectToRelated"
            />
        </div>

        <FileHistory :events="events" />

        <div
            v-if="preview.readerError.value && !isYaml"
            class="q-my-md text-negative text-center"
        >
            <q-icon name="sym_o_warning" />
            {{ preview.readerError.value }}
        </div>
    </div>

    <div v-else class="text-center q-pa-md">
        <q-spinner size="3em" color="primary" />
        <div class="text-grey q-mt-sm">Loading file details...</div>
    </div>
</template>

<script setup lang="ts">
import { FileState, FileType } from '@common/enum';
import { copyToClipboard, Notify } from 'quasar';
import { useRosmsgPreview } from 'src/composables/use-rosmsg-preview';
import {
    registerNoPermissionErrorHandler,
    useFile,
    useFileEvents,
} from 'src/hooks/query-hooks';
import { useFileUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { _downloadFile } from 'src/services/generic';
import { downloadFile } from 'src/services/queries/file';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FileHeader from './file-header.vue';
import FileHistory from './file-history.vue';
import FileTopicList from './file-topic-list.vue';

const $router = useRouter();
const fileUuid = useFileUUID();

// --- Data Fetching ---
const { isLoading, data: file, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);
const { data: events } = useFileEvents(fileUuid);

const preview = useRosmsgPreview();
const yamlContent = ref<string | null>(null);

// Detect YAML by extension
const isYaml = computed(() => {
    const name = file.value?.filename?.toLowerCase() ?? '';
    return name.endsWith('.yml') || name.endsWith('.yaml');
});

// Only show topics if it is NOT a yaml file
const displayTopics = computed(
    () => file.value?.state === FileState.OK && !isYaml.value,
);

// --- Initialization Logic ---
watch(
    () => file.value,
    async (currentFile) => {
        // Guard clauses
        if (
            !currentFile ||
            currentFile.state !== FileState.OK ||
            preview.isReaderReady.value
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

            if (isYaml.value) {
                const response = await fetch(dynamicUrl);
                yamlContent.value = response.ok
                    ? await response.text()
                    : `Error loading content: ${response.statusText}`;
                return;
            }

            // Only proceed if it is actually a binary format
            const strategyType =
                currentFile.type === FileType.BAG ? 'rosbag' : 'mcap';

            await preview.init(dynamicUrl, strategyType);
        } catch (init_error: unknown) {
            console.error('Error setting up preview:', init_error);
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

<style scoped>
.text-code {
    font-family: monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #333;
}
.border-solid {
    border: 1px solid #e0e0e0;
}
</style>
