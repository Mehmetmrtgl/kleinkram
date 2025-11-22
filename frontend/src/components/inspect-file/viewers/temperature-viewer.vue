<template>
    <div class="temperature-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="grey-3" text-color="black">
                        <q-icon name="sym_o_schedule" size="xs" class="q-mr-xs" />
                        {{ duration.toFixed(2) }}s
                    </q-badge>
                    <q-badge color="orange-1" text-color="orange-9">
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

            <SimpleTimeChart
                title="Temperature (°C)"
                :series="tempSeries"
            />

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

const tempSeries = computed((): ChartSeries[] => {
    const data = props.messages.map((msg) => ({
        time: Number(msg.logTime - startTime.value) / 1_000_000_000,
        value: msg.data.temperature || 0,
    }));

    return [{ name: 'Temp', color: '#F57C00', data }];
});

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