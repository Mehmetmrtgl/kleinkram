<template>
    <div class="point-cloud-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="indigo-1" text-color="indigo-9">
                        {{ width }}x{{ height }} Points
                    </q-badge>
                    <div class="text-caption text-grey-7">
                        Frame: {{ frameId }}
                    </div>
                </div>
                <div class="row q-gutter-x-sm">
                    <q-btn
                        icon="sym_o_restart_alt"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="resetView"
                    >
                        <q-tooltip>Reset View</q-tooltip>
                    </q-btn>
                    <q-btn
                        icon="sym_o_content_copy"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="copyRaw"
                    >
                        <q-tooltip>Copy Metadata</q-tooltip>
                    </q-btn>
                </div>
            </div>

            <div
                class="canvas-wrapper bg-grey-9 rounded-borders flex flex-center relative-position overflow-hidden"
                @wheel.prevent="handleWheel"
                @mousedown="startDrag"
                @mousemove="onDrag"
                @mouseup="stopDrag"
                @mouseleave="stopDrag"
            >
                <canvas ref="canvasRef" class="pc-canvas" />

                <div class="absolute-top-left q-pa-sm text-white text-caption no-pointer-events">
                    <div>Top-Down View (XY Plane)</div>
                    <div class="text-grey-5">Color: Z-Height</div>
                </div>

                <div class="absolute-bottom-right q-pa-md column q-gutter-y-sm">
                    <q-btn round color="grey-8" text-color="white" icon="sym_o_add" size="sm" @click="zoomIn" />
                    <q-btn round color="grey-8" text-color="white" icon="sym_o_remove" size="sm" @click="zoomOut" />
                </div>

                <div class="absolute-top-right q-pa-sm text-grey-5 text-caption no-pointer-events">
                    {{ (userZoom * 100).toFixed(0) }}%
                </div>
            </div>

            <div class="row justify-between items-center q-mt-md">
                <div class="text-caption text-grey-7">
                    Message {{ currentIndex + 1 }} of {{ messages.length }}
                </div>
                <div class="row q-gutter-sm">
                    <q-btn
                        round flat dense
                        icon="sym_o_skip_previous"
                        :disable="currentIndex <= 0"
                        @click="currentIndex--"
                    />
                    <q-btn
                        round flat dense
                        icon="sym_o_skip_next"
                        :disable="currentIndex >= messages.length - 1"
                        @click="currentIndex++"
                    />
                </div>
            </div>

            <div v-if="messages.length < totalCount" class="text-center q-mt-sm">
                <q-btn
                    label="Load More Scans"
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
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const currentIndex = ref(0);

const CANVAS_SIZE = 600;

// --- Interaction State ---
const userZoom = ref(1.0);
const userPan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const lastMouse = ref({ x: 0, y: 0 });

// --- Computed Data Access ---
const currentMessage = computed(() => props.messages[currentIndex.value] || null);
const width = computed(() => currentMessage.value?.data?.width || 0);
const height = computed(() => currentMessage.value?.data?.height || 0);
const frameId = computed(() => currentMessage.value?.data?.header?.frame_id || '');

onMounted(() => {
    if (!props.messages || props.messages.length === 0) {
        emit('load-required');
    } else {
        renderCloud();
    }
});

watch(currentIndex, renderCloud);
watch(() => props.messages.length, () => {
    if (currentIndex.value >= props.messages.length) currentIndex.value = 0;
    renderCloud();
});

// --- Interaction Logic ---

function resetView() {
    userZoom.value = 1.0;
    userPan.value = { x: 0, y: 0 };
    renderCloud();
}

function zoomIn() {
    userZoom.value *= 1.2;
    renderCloud();
}

function zoomOut() {
    userZoom.value /= 1.2;
    renderCloud();
}

function handleWheel(e: WheelEvent) {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    userZoom.value *= delta;
    renderCloud();
}

function startDrag(e: MouseEvent) {
    isDragging.value = true;
    lastMouse.value = { x: e.clientX, y: e.clientY };
}

function onDrag(e: MouseEvent) {
    if (!isDragging.value) return;
    const dx = e.clientX - lastMouse.value.x;
    const dy = e.clientY - lastMouse.value.y;

    userPan.value.x += dx;
    userPan.value.y += dy;

    lastMouse.value = { x: e.clientX, y: e.clientY };
    renderCloud();
}

function stopDrag() {
    isDragging.value = false;
}

// --- Parsing Logic ---
interface Point { x: number; y: number; z: number; }

function parsePoints(msg: any): Point[] {
    if (!msg) return [];

    const fields = msg.fields as any[];
    const data = msg.data as Uint8Array | number[];
    const pointStep = msg.point_step as number;
    const isBigEndian = msg.is_bigendian;
    const totalPoints = msg.width * msg.height;

    const bytes = (data instanceof Uint8Array) ? data : new Uint8Array(data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const xField = fields.find((f: any) => f.name === 'x');
    const yField = fields.find((f: any) => f.name === 'y');
    const zField = fields.find((f: any) => f.name === 'z');

    if (!xField || !yField) return [];

    const xOff = xField.offset;
    const yOff = yField.offset;
    const zOff = zField ? zField.offset : -1;
    const isFloat32 = (xField.datatype === 7);

    const points: Point[] = [];

    for (let i = 0; i < totalPoints; i++) {
        const base = i * pointStep;
        if (base + pointStep > bytes.length) break;

        let x, y, z = 0;
        if (isFloat32) {
            x = view.getFloat32(base + xOff, !isBigEndian);
            y = view.getFloat32(base + yOff, !isBigEndian);
            if (zOff >= 0) z = view.getFloat32(base + zOff, !isBigEndian);
        } else {
            x = view.getFloat64(base + xOff, !isBigEndian);
            y = view.getFloat64(base + yOff, !isBigEndian);
            if (zOff >= 0) z = view.getFloat64(base + zOff, !isBigEndian);
        }

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        points.push({ x, y, z });
    }
    return points;
}

// --- Rendering Logic ---
function renderCloud() {
    const canvas = canvasRef.value;
    if (!canvas || !currentMessage.value) return;

    const points = parsePoints(currentMessage.value.data);
    if (points.length === 0) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Calculate Auto-Fit Bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const rangeZ = maxZ - minZ || 1;

    // Base Scale (Auto-Fit)
    const maxRange = Math.max(rangeX, rangeY);
    const baseScale = (CANVAS_SIZE - 40) / maxRange;

    // Apply User Zoom
    const finalScale = baseScale * userZoom.value;

    // Calculate Center Offset + User Pan
    const contentWidth = rangeX * finalScale;
    const contentHeight = rangeY * finalScale;

    // Center logic: (Canvas - Content) / 2
    // We subtract minX * scale to shift the local 0,0 to the start of the data
    const offsetX = (CANVAS_SIZE - contentWidth) / 2 - (minX * finalScale) + userPan.value.x;

    // Y is inverted (Top-Down Map). Standard is Up=Y. Canvas is Down=Y.
    // We anchor to the bottom of the content area to flip it correctly?
    // Let's use standard flip logic: canvas_y = H - (world_y * scale + off_y)
    const offsetY = (CANVAS_SIZE - contentHeight) / 2 - (minY * finalScale) - userPan.value.y;

    // 2. Draw
    const imgData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    const data = imgData.data;

    for (const p of points) {
        const cx = Math.floor(p.x * finalScale + offsetX);
        const cy = Math.floor(CANVAS_SIZE - (p.y * finalScale + offsetY));

        if (cx >= 0 && cx < CANVAS_SIZE && cy >= 0 && cy < CANVAS_SIZE) {
            const idx = (cy * CANVAS_SIZE + cx) * 4;

            // Z-Coloring
            const zn = (p.z - minZ) / rangeZ;
            const r = Math.floor(zn * 255);
            const b = Math.floor((1 - zn) * 255);
            const g = 50;

            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw Crosshair (0,0)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    const originX = Math.floor(0 * finalScale + offsetX);
    const originY = Math.floor(CANVAS_SIZE - (0 * finalScale + offsetY));

    if (originX >= 0 && originX <= CANVAS_SIZE) {
        ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, CANVAS_SIZE); ctx.stroke();
    }
    if (originY >= 0 && originY <= CANVAS_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(CANVAS_SIZE, originY); ctx.stroke();
    }
}

async function copyRaw(): Promise<void> {
    if (!currentMessage.value) return;
    const meta = { ...currentMessage.value.data, data: '[Binary Blob Omitted]' };
    await quasarCopy(JSON.stringify(meta, null, 2));
    Notify.create({
        message: 'Metadata copied',
        color: 'positive',
        timeout: 1000,
    });
}
</script>

<style scoped>
.border-color { border: 1px solid #e0e0e0; }
.pc-canvas {
    width: 100%;
    height: 100%;
    max-width: 600px;
    max-height: 600px;
    image-rendering: pixelated;
    cursor: move; /* Indicate draggable */
}
.no-pointer-events {
    pointer-events: none;
}
</style>