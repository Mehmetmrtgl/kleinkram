<template>
    <div class="twist-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="grey-3" text-color="black">
                        <q-icon name="sym_o_schedule" size="xs" class="q-mr-xs" />
                        {{ duration.toFixed(2) }}s
                    </q-badge>
                    <q-badge color="deep-purple-1" text-color="deep-purple-9">
                        {{ messages.length }} samples
                    </q-badge>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    round
                    dense
                    size="sm"
                    color="grey-7"
                    @click="copyRaw(messages)"
                >
                    <q-tooltip>Copy JSON</q-tooltip>
                </q-btn>
            </div>

            <div class="q-gutter-y-md">
                <SimpleTimeChart
                    title="Linear Velocity (m/s)"
                    :series="linearSeries"
                />
                <SimpleTimeChart
                    title="Angular Velocity (rad/s)"
                    :series="angularSeries"
                />
            </div>

            <div
                v-if="messages.length < totalCount"
                class="text-center q-mt-md"
            >
                <div class="text-caption text-grey-7 q-mb-xs">
                    Showing {{ messages.length }} / {{ totalCount }} points.
                </div>
                <q-btn
                    label="Load All Data"
                    icon="sym_o_download"
                    size="sm"
                    flat
                    color="primary"
                    @click="$emit('load-more')"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, onMounted } from 'vue';
import SimpleTimeChart, {
    type ChartSeries,
} from './simple-time-chart.vue';

const props = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    if (!props.messages || props.messages.length === 0) emit('load-required');
});

// --- Data Processing ---
const startTime = computed(() => props.messages[0]?.logTime || 0n);

const duration = computed(() => {
    if (props.messages.length < 2) return 0;
    const end = props.messages[props.messages.length - 1].logTime;
    return Number(end - startTime.value) / 1_000_000_000;
});

// Helper to extract series data
const extractSeries = (
    category: 'linear' | 'angular',
): ChartSeries[] => {
    const xData: any[] = [];
    const yData: any[] = [];
    const zData: any[] = [];

    props.messages.forEach((msg) => {
        // Normalized Time
        const t = Number(msg.logTime - startTime.value) / 1_000_000_000;
        // Handle TwistStamped vs Twist
        const twist = msg.data.twist || msg.data;
        const vec = twist[category];

        if (vec) {
            xData.push({ time: t, value: vec.x || 0 });
            yData.push({ time: t, value: vec.y || 0 });
            zData.push({ time: t, value: vec.z || 0 });
        }
    });

    return [
        { name: 'X', color: 'red', data: xData },
        { name: 'Y', color: 'green', data: yData },
        { name: 'Z', color: 'blue', data: zData },
    ];
};

const linearSeries = computed(() => extractSeries('linear'));
const angularSeries = computed(() => extractSeries('angular'));

async function copyRaw(data: any): Promise<void> {
    await quasarCopy(JSON.stringify(data, null, 2));
    Notify.create({
        message: 'Data copied',
        color: 'positive',
        timeout: 1000,
    });
}
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
</style>