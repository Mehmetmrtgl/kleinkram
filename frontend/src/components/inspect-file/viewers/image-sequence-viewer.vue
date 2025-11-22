<template>
    <div
        class="image-sequence-viewer bg-white shadow-1 rounded-borders q-pa-md"
    >
        <!-- Canvas Viewport -->
        <div
            class="relative-position flex flex-center bg-grey-3 overflow-hidden"
            style="min-height: 300px"
        >
            <canvas ref="canvasReference" class="preview-canvas" />

            <!-- Overlays -->
            <div
                v-if="renderError"
                class="absolute-center text-negative bg-white q-pa-sm rounded-borders"
            >
                <q-icon name="warning" /> {{ renderError }}
            </div>
        </div>

        <!-- Controls -->
        <div class="q-mt-md">
            <PlaybackControls
                v-model="currentIndex"
                :max="messages.length - 1"
                :is-playing="isPlaying"
                @toggle="togglePlay"
                @next="step(1)"
                @prev="step(-1)"
            />
        </div>

        <!-- Metadata Footer -->
        <div class="row justify-between q-mt-sm text-caption text-grey-6">
            <div>Time: {{ formatTime(currentMessage?.logTime) }}</div>
            <div>
                Encoding:
                {{
                    currentMessage?.data?.encoding ||
                    currentMessage?.data?.format ||
                    'unknown'
                }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useImageDecoder } from '../../../composables/use-image-decoder';
import PlaybackControls from './playback-controls.vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
}>();

// --- State ---
const canvasReference = ref<HTMLCanvasElement | null>(null);
const currentIndex = ref(0);
const isPlaying = ref(false);
let intervalId: any = null;

// --- Data Access ---
const currentMessage = computed(() => properties.messages[currentIndex.value]);
const currentData = computed(() => currentMessage.value?.data);

// --- Rendering ---
const { draw, renderError } = useImageDecoder(canvasReference, currentData);

// Ensure we draw the first frame when mounted/data loaded
onMounted(() => {
    if (currentData.value) draw();
});

// --- Playback Logic ---
const togglePlay = (): void => {
    isPlaying.value = !isPlaying.value;
    if (isPlaying.value) {
        intervalId = setInterval(() => {
            step(1);
        }, 100); // 10 FPS default
    } else {
        clearInterval(intervalId);
    }
};

const step = (direction: number): void => {
    let next = currentIndex.value + direction;
    if (next >= properties.messages.length) {
        next = 0; // Loop
    } else if (next < 0) {
        next = properties.messages.length - 1;
    }
    currentIndex.value = next;
};

const formatTime = (nano?: bigint): string => {
    if (!nano) return '-';
    const millis = Number(nano / 1_000_000n);
    return new Date(millis).toISOString().split('T')[1].replace('Z', '');
};

onUnmounted(() => {
    clearInterval(intervalId);
});
</script>

<style scoped>
.preview-canvas {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
}
</style>
