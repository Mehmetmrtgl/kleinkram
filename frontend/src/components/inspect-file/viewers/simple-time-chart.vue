<template>
    <div class="simple-time-chart">
        <div class="row justify-between items-center q-mb-xs">
            <div class="text-subtitle2">{{ title }}</div>
            <div
                v-if="series.length > 0"
                class="text-caption row q-gutter-x-sm"
            >
                <div
                    v-for="s in series"
                    :key="s.name"
                    class="row items-center"
                    :style="{ color: s.color }"
                >
                    <span style="font-size: 14px; margin-right: 2px">•</span>
                    {{ s.name }}
                </div>
            </div>
        </div>

        <div class="graph-wrapper bg-grey-1 rounded-borders">
            <svg
                :viewBox="`0 0 ${width} ${height}`"
                class="chart-svg"
                preserveAspectRatio="none"
            >
                <line
                    v-if="yRange.min < 0 && yRange.max > 0"
                    :x1="0"
                    :y1="getY(0)"
                    :x2="width"
                    :y2="getY(0)"
                    stroke="#ccc"
                    stroke-width="1"
                    stroke-dasharray="4"
                />

                <polyline
                    v-for="s in sampledSeries"
                    :key="s.name"
                    fill="none"
                    :stroke="s.color"
                    stroke-width="1.5"
                    :points="getPoints(s.data)"
                />
            </svg>

            <div class="axis-labels">
                <span class="max">{{ fmt(yRange.max) }}</span>
                <span class="min">{{ fmt(yRange.min) }}</span>
            </div>

            <div v-if="isSubsampled" class="sampling-badge">
                Subsampled
                <q-tooltip>
                    Data exceeded 10k points. Displaying reduced set for
                    performance.
                </q-tooltip>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface DataPoint {
    time: number; // Relative time in seconds
    value: number;
}

export interface ChartSeries {
    name: string;
    color: string;
    data: DataPoint[];
}

const properties = withDefaults(
    defineProps<{
        series: ChartSeries[];
        title?: string;
        height?: number;
        width?: number;
    }>(),
    {
        title: '',
        height: 150,
        width: 1000,
    },
);

const SUBSAMPLE_THRESHOLD = 10_000;
const TARGET_POINTS = 2000;

// --- Scaling Logic (Uses FULL Data for Accuracy) ---
const yRange = computed(() => {
    let min = Infinity;
    let max = -Infinity;

    // Find global min/max across all series (full dataset)
    // Note: Iterating 50k JS objects is fast; rendering 50k DOM nodes is slow.
    for (const s of properties.series) {
        for (const p of s.data) {
            if (p.value < min) min = p.value;
            if (p.value > max) max = p.value;
        }
    }

    // Default / Flat line handling
    if (min === Infinity) {
        min = 0;
        max = 1;
    }
    if (min === max) {
        min -= 1;
        max += 1;
    }

    // Add 10% padding
    const range = max - min;
    return {
        min: min - range * 0.1,
        max: max + range * 0.1,
        range: range * 1.2 || 1, // Avoid div by zero
    };
});

const maxTime = computed(() => {
    let max = 0;
    for (const s of properties.series) {
        if (s.data.length > 0) {
            const last = s.data.at(-1)?.time ?? 0;
            if (last > max) max = last;
        }
    }
    return max || 1;
});

// --- Subsampling Logic ---
const isSubsampled = computed(() => {
    return properties.series.some((s) => s.data.length > SUBSAMPLE_THRESHOLD);
});

const sampledSeries = computed(() => {
    return properties.series.map((s) => {
        // If small enough, return original
        if (s.data.length <= SUBSAMPLE_THRESHOLD) return s;

        // Calculate stride to reach target count
        const stride = Math.ceil(s.data.length / TARGET_POINTS);

        const reducedData = [];
        for (let index = 0; index < s.data.length; index += stride) {
            reducedData.push(s.data[index]);
        }

        // Ensure the very last point is included so the graph doesn't look cut off
        if (
            reducedData.length > 0 &&
            s.data.length > 0 &&
            reducedData.at(-1) !== s.data.at(-1)
        ) {
            reducedData.push(s.data.at(-1));
        }

        return {
            ...s,
            data: reducedData,
        };
    });
});

// --- Coordinate Mapping ---
const getY = (value: number): number => {
    const percent = (value - yRange.value.min) / yRange.value.range;
    return properties.height * (1 - percent);
};

const getPoints = (data: (DataPoint | undefined)[]): string => {
    return data
        .map((p) => {
            const x = ((p?.time ?? 0) / maxTime.value) * properties.width;
            const y = getY(p?.value ?? 0);
            return `${x},${y}`;
        })
        .join(' ');
};

const fmt = (n: number): string => n.toFixed(2);
</script>

<style scoped>
.graph-wrapper {
    position: relative;
    height: v-bind(height + 'px');
    overflow: hidden;
    border: 1px solid #e0e0e0;
}
.chart-svg {
    width: 100%;
    height: 100%;
}
.axis-labels {
    position: absolute;
    top: 4px;
    right: 4px;
    bottom: 4px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
}
.max,
.min {
    font-size: 10px;
    background: rgba(255, 255, 255, 0.7);
    padding: 1px 3px;
    border-radius: 3px;
    color: #555;
    font-weight: 600;
}
.sampling-badge {
    position: absolute;
    bottom: 4px;
    left: 4px;
    font-size: 9px;
    background: rgba(255, 243, 224, 0.9);
    color: #e65100;
    padding: 1px 4px;
    border-radius: 2px;
    cursor: help;
}
</style>
