import { reactive, Ref, ref, shallowRef } from 'vue';
import { LogStrategy, McapStrategy, RosbagStrategy } from './rosmsg-strategies';
import { formatPayload, UniversalHttpReader } from './rosmsg-utilities.ts';

export function useRosmsgPreview(): {
    isReaderReady: Ref<boolean, boolean>;
    readerError: Ref<string | null, string | null>;
    topicPreviews: Record<string, any[]>;
    topicLoadingState: Record<string, boolean>;
    init: (url: string, type: 'mcap' | 'rosbag') => Promise<void>;
    fetchTopicMessages: (topicName: string) => Promise<void>;
    formatPayload: (data: any) => string;
} {
    const isReaderReady = ref(false);
    const readerError = ref<string | null>(null);
    const topicPreviews = reactive<Record<string, any[]>>({});
    const topicLoadingState = reactive<Record<string, boolean>>({});

    // Strategy is shallowRef because it contains complex class instances
    const strategy = shallowRef<LogStrategy | null>(null);

    async function init(url: string, type: 'mcap' | 'rosbag'): Promise<void> {
        isReaderReady.value = false;
        readerError.value = null;

        try {
            const httpReader = new UniversalHttpReader(url);
            await httpReader.init();

            // Strategy selection happens dynamically now
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

    async function fetchTopicMessages(topicName: string): Promise<void> {
        if (!strategy.value) return;
        topicLoadingState[topicName] = true;
        try {
            topicPreviews[topicName] =
                await strategy.value.getMessages(topicName);
        } catch (error) {
            console.error(`Error reading ${topicName}`, error);
            topicPreviews[topicName] = [];
        } finally {
            topicLoadingState[topicName] = false;
        }
    }

    return {
        isReaderReady,
        readerError,
        topicPreviews,
        topicLoadingState,
        init,
        fetchTopicMessages,
        formatPayload,
    };
}
