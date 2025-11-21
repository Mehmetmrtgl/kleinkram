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
                <span>Loading content...</span>
            </div>
        </div>

        <div v-else-if="displayTopics && preview.isReaderReady.value">
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

        <div
            v-else-if="!displayTopics && !isLoading"
            class="text-center q-pa-xl bg-grey-1 rounded-borders border-dashed text-grey-7"
        >
            <q-icon name="sym_o_description" size="4em" class="q-mb-md" />
            <div class="text-h6">No Preview Available</div>
            <div class="text-caption q-mt-xs">
                Preview is not currently supported for
                <span class="text-weight-bold">.{{ fileExtension }}</span>
                files.
            </div>
            <q-btn
                label="Download File"
                color="primary"
                flat
                icon="sym_o_download"
                class="q-mt-md"
                @click="handleDownload"
            />
        </div>

        <FileHistory :events="events" />

        <div
            v-if="preview.readerError.value && displayTopics"
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
const yamlContent = ref<string | undefined>(undefined);

const fileExtension = computed(() => {
    const name = file.value?.filename ?? '';
    return name.split('.').pop()?.toLowerCase() ?? '';
});

const isYaml = computed(() => {
    return ['yml', 'yaml'].includes(fileExtension.value);
});

const isSupportedBinary = computed(() => {
    if (!file.value) return false;
    const isBagType = file.value.type === FileType.BAG;
    const isMcapType = file.value.type === FileType.MCAP;

    const isDatabase3 = fileExtension.value === 'db3';

    return (isBagType || isMcapType) && !isDatabase3;
});

const displayTopics = computed(
    () => file.value?.state === FileState.OK && isSupportedBinary.value,
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
            const dynamicUrl = await downloadFile(
                currentFile.uuid,
                false,
                true,
            );

            // 1. Handle Text Files (YAML)
            if (isYaml.value) {
                console.log('Loading YAML content...');
                const response = await fetch(dynamicUrl);
                yamlContent.value = response.ok
                    ? await response.text()
                    : `Error loading content: ${response.statusText}`;
                return;
            }

            // 2. Handle Supported Binaries
            if (isSupportedBinary.value) {
                console.log(`Initializing preview for ${currentFile.type}...`);
                const strategyType =
                    currentFile.type === FileType.BAG ? 'rosbag' : 'mcap';
                await preview.init(dynamicUrl, strategyType);
                return;
            }

            // 3. Unsupported files: Do nothing (Template renders placeholder)
            console.log(`No preview strategy for .${fileExtension.value}`);
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
.border-dashed {
    border: 2px dashed #e0e0e0;
}
</style>
