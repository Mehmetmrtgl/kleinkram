<template>
    <div class="col-2">
        {{ tagValues[tagTypeUuid].name }}
    </div>
    <div v-if="tagLookup[tagTypeUuid]" class="col-2">
        <q-input
            v-if="tagLookup[tagTypeUuid]?.datatype !== DataType.BOOLEAN"
            v-model="internalValue"
            label="Enter Filter Value"
            outlined
            dense
            clearable
            required
            :type="
                inputFieldTypeMapping(
                    tagLookup[tagTypeUuid]?.datatype ?? DataType.STRING,
                )
            "
            @clear="clearValue"
        />
        <q-toggle
            v-if="tagLookup[tagTypeUuid]?.datatype === DataType.BOOLEAN"
            v-model="internalValue"
            :label="
                internalValue === undefined
                    ? '-'
                    : internalValue
                      ? 'True'
                      : 'False'
            "
            outlined
            dense
            required
            flat
            style="width: 100%"
            :options="[
                { label: 'True', value: true },
                { label: 'False', value: false },
            ]"
        />
    </div>
</template>

<script setup lang="ts">
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { DataType } from '@common/enum';
import { defineEmits, defineProps, ref, watch } from 'vue';

// Modern type-safe interface
interface TagFilterValue {
    name: string;
    value: string | number | boolean | Date | undefined;
}

type TagFilter = Record<string, TagFilterValue>;

const properties = defineProps<{
    tagTypeUuid: string;
    tagLookup: Record<string, TagTypeDto>;
    tagValues: TagFilter;
}>();

const emit = defineEmits<{
    'update:tagValues': [value: TagFilter];
}>();

// Initialize with proper type safety and reactivity
const internalValue = ref(properties.tagValues[properties.tagTypeUuid]?.value);

// Watch for external changes to tagValues prop
watch(
    () => properties.tagValues[properties.tagTypeUuid]?.value,
    (newValue) => {
        if (newValue !== internalValue.value) {
            internalValue.value = newValue;
        }
    },
    { immediate: true }
);

const inputFieldTypeMapping = (datatype: DataType) => {
    switch (datatype) {
        case DataType.NUMBER: {
            return 'number';
        }
        case DataType.DATE: {
            return 'date';
        }
        default: {
            return 'text';
        }
    }
};

// Watch for changes with proper type handling
watch(internalValue, (newValue) => {
    const currentTag = properties.tagLookup[properties.tagTypeUuid];
    if (!currentTag) {
        return; // Tag type not found, skip update
    }
    
    const currentFilterValue = properties.tagValues[properties.tagTypeUuid];
    const updatedTagValues: TagFilter = {
        ...properties.tagValues,
        [properties.tagTypeUuid]: {
            name: currentFilterValue?.name || currentTag.name,
            value: newValue,
        },
    };
    
    emit('update:tagValues', updatedTagValues);
}, { immediate: false });

// Modern, type-safe clear function
const clearValue = (): void => {
    const updatedTagValues: TagFilter = Object.fromEntries(
        Object.entries(properties.tagValues).filter(
            ([key]) => key !== properties.tagTypeUuid,
        ),
    ) as TagFilter;
    
    emit('update:tagValues', updatedTagValues);
};
</script>
