<template>
    <div class="message-viewer bg-grey-1 q-pa-sm rounded-borders">
        <div class="row justify-between items-center q-mb-sm">
            <div class="text-subtitle2 text-grey-8 flex items-center">
                {{ topicName }}
                <q-badge color="grey-4" text-color="black" class="q-ml-sm">{{
                        messageType
                    }}</q-badge>
            </div>
            <q-btn
                v-if="hasData && !isImage"
                label="Load More"
                size="sm"
                flat
                color="primary"
                @click="$emit('load-more')"
            />
        </div>

        <div
            v-if="error"
            class="text-negative q-pa-md bg-red-1 rounded-borders"
        >
            <q-icon name="sym_o_error" /> Failed to load: {{ error }}
        </div>

        <div
            v-else-if="isLoading && !hasData"
            class="row items-center q-pa-md text-grey-7"
        >
            <q-spinner-dots size="1.5em" />
            <span class="q-ml-sm">Fetching data...</span>
        </div>

        <component
            :is="activeComponent"
            v-else-if="hasData || isLoading"
            :messages="messages"
            :topic-name="topicName"
            :total-count="totalCount"
            @load-required="$emit('load-required')"
        />

        <div
            v-else
            class="text-italic text-grey q-pa-md text-center cursor-pointer"
            @click="$emit('load-required')"
        >
            <q-btn
                label="Load Messages"
                icon="sym_o_download"
                flat
                dense
                color="primary"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
    detectPreviewType,
    getViewerComponent,
    PreviewType,
} from '../../services/message-factory';

const properties = defineProps<{
    topicName: string;
    messageType: string;
    messages: any[];
    totalCount: number;
    isLoading: boolean;
    error: string | null;
}>();

defineEmits(['load-more', 'load-required']);

const hasData = computed(
    () => properties.messages && properties.messages.length > 0,
);

// Determine the type based on the message string + sample data
const currentPreviewType = computed(() => {
    const sample = properties.messages?.[0]?.data;
    return detectPreviewType(properties.messageType, sample);
});

// Helper to check if it is an image
const isImage = computed(() => currentPreviewType.value === PreviewType.IMAGE);

// Get the correct component
const activeComponent = computed(() => {
    return getViewerComponent(currentPreviewType.value);
});
</script>