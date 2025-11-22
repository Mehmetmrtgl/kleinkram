<template>
    <div class="ros-log-viewer">
        <div class="bg-white rounded-borders border-color">
            <div class="row justify-between items-center q-pa-md border-bottom">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="blue-grey-1" text-color="blue-grey-9">
                        {{ messages.length }} logs
                    </q-badge>
                    <div class="text-caption text-grey-7">
                        Showing first 100 entries
                    </div>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    round
                    dense
                    size="sm"
                    color="grey-7"
                    @click="copyRaw"
                >
                    <q-tooltip>Copy JSON</q-tooltip>
                </q-btn>
            </div>

            <q-list separator dense>
                <q-item
                    v-for="(msg, idx) in messages"
                    :key="idx"
                    class="q-py-sm items-start hover-bg"
                >
                    <q-item-section avatar style="min-width: 40px">
                        <q-icon
                            :name="getLevelIcon(msg.data.level)"
                            :color="getLevelColor(msg.data.level)"
                            size="sm"
                        />
                    </q-item-section>

                    <q-item-section>
                        <div class="row items-baseline q-gutter-x-sm">
                            <span class="text-weight-bold text-body2">
                                {{ msg.data.name }}
                            </span>
                            <span class="text-caption text-grey-6 font-mono">
                                {{ formatTime(msg.logTime) }}
                            </span>
                        </div>

                        <div class="text-body2 q-mt-xs break-word">
                            {{ msg.data.msg }}
                        </div>

                        <div
                            class="text-caption text-grey-5 q-mt-xs font-mono"
                            style="font-size: 10px"
                        >
                            {{ msg.data.file }}:{{ msg.data.line }}
                            <span v-if="msg.data.function"
                                >({{ msg.data.function }})</span
                            >
                        </div>
                    </q-item-section>
                </q-item>
            </q-list>

            <div
                v-if="messages.length < totalCount"
                class="text-center q-pa-md bg-grey-1"
            >
                <div class="text-caption text-grey-7 q-mb-xs">
                    Showing {{ messages.length }} / {{ totalCount }} logs.
                </div>
                <q-btn
                    label="Load More"
                    icon="sym_o_download"
                    size="sm"
                    flat
                    color="primary"
                    @click="loadMore"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { onMounted } from 'vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

// --- Helpers ---
const formatTime = (nano: bigint): string => {
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);

    if (Number.isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    const timePart = date.toISOString().split('T')[1];
    return timePart?.replace('Z', '') ?? 'Invalid Time';
};

// ROS Log Levels: 1=Debug, 2=Info, 4=Warn, 8=Error, 16=Fatal
const getLevelColor = (level: number): string => {
    switch (level) {
        case 1: {
            return 'grey';
        } // DEBUG
        case 2: {
            return 'positive';
        } // INFO
        case 4: {
            return 'warning';
        } // WARN
        case 8: {
            return 'negative';
        } // ERROR
        case 16: {
            return 'purple';
        } // FATAL
        default: {
            return 'grey-8';
        }
    }
};

const getLevelIcon = (level: number): string => {
    switch (level) {
        case 1: {
            return 'sym_o_bug_report';
        }
        case 2: {
            return 'sym_o_info';
        }
        case 4: {
            return 'sym_o_warning';
        }
        case 8: {
            return 'sym_o_error';
        }
        case 16: {
            return 'sym_o_dangerous';
        }
        default: {
            return 'sym_o_help';
        }
    }
};

async function copyRaw(): Promise<void> {
    await quasarCopy(JSON.stringify(properties.messages, null, 2));
    Notify.create({
        message: 'Logs copied',
        color: 'positive',
        timeout: 1000,
    });
}

const loadMore = (): void => {
    emit('load-more');
};
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
.border-bottom {
    border-bottom: 1px solid #e0e0e0;
}
.font-mono {
    font-family: 'Roboto Mono', monospace;
}
.break-word {
    word-wrap: break-word;
    white-space: pre-wrap;
}
.hover-bg:hover {
    background-color: #fafafa;
}
</style>
