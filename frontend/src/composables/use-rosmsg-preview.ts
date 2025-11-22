import { UniversalHttpReader } from '@common/universal-http-reader';
import { reactive, Ref, ref, shallowRef } from 'vue';
import { LogStrategy, McapStrategy, RosbagStrategy } from './rosmsg-strategies';
import { formatPayload } from './rosmsg-utilities.ts';

export function useRosmsgPreview(): {
    isReaderReady: Ref<boolean, boolean>;
    readerError: Ref<string | null, string | null>;
    topicPreviews: Record<string, any[]>;
    topicLoadingState: Record<string, boolean>;
    topicErrors: Record<string, string | null>;
    init: (url: string, type: 'mcap' | 'rosbag') => Promise<void>;
    fetchTopicMessages: (topicName: string, limit?: number) => Promise<void>;
    formatPayload: (data: any) => string;
} {
    const isReaderReady = ref(false);
    const readerError = ref<string | null>(null);
    const topicPreviews = reactive<Record<string, any[]>>({});
    const topicLoadingState = reactive<Record<string, boolean>>({});

    const topicErrors = reactive<Record<string, string | null>>({});

    const strategy = shallowRef<LogStrategy | null>(null);

    async function init(url: string, type: 'mcap' | 'rosbag'): Promise<void> {
        isReaderReady.value = false;
        readerError.value = null;
        // Clear previous errors on new file load
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        for (const k of Object.keys(topicErrors)) delete topicErrors[k];

        try {
            const httpReader = new UniversalHttpReader(url);
            await httpReader.init();

            const impl =
                type === 'mcap' ? new McapStrategy() : new RosbagStrategy();
            await impl.init(httpReader);

            strategy.value = impl;
            isReaderReady.value = true;
        } catch (error: any) {
            console.error('Preview init failed:', error);
            readerError.value = error.message;
        }
    }

    /**
     * Fetches messages for a topic.
     * Uses streaming to populate the array as data arrives.
     */
    async function fetchTopicMessages(
        topicName: string,
        limit?: number,
    ): Promise<void> {
        if (!strategy.value) return;

        topicLoadingState[topicName] = true;
        topicErrors[topicName] = null;

        // Reset the array so it can be filled from scratch
        // If you want append logic (load more), you would check array length here
        // But typically we are reloading or loading a fresh batch.
        topicPreviews[topicName] = [];

        try {
            // We ignore the return value (full array) because we populate
            // the reactive array via the callback for immediate UI feedback.
            await strategy.value.getMessages(topicName, limit, (message) => {
                topicPreviews[topicName].push(message);
            });
        } catch (error: unknown) {
            console.error(`Error reading ${topicName}`, error);
            // Don't necessarily clear previews on error, we might have partial data
            if (!topicPreviews[topicName]) topicPreviews[topicName] = [];

            topicErrors[topicName] =
                error instanceof Error ? error.message : String(error);
        } finally {
            topicLoadingState[topicName] = false;
        }
    }

    return {
        isReaderReady,
        readerError,
        topicPreviews,
        topicLoadingState,
        topicErrors,
        init,
        fetchTopicMessages,
        formatPayload,
    };
}
