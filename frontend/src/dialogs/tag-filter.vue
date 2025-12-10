<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <div class="q-mt-md row">
                <div class="col-4">
                    <q-input v-model="tagtype" label="Search Metadata" />
                </div>
                <div class="col-2">
                    <q-btn label="Search" color="primary" />
                </div>
            </div>
            <div class="q-mt-md row">
                <div class="col-12">
                    <MetadataTypeTable
                        :rows="data ?? []"
                        :columns="columns"
                        :filter="tagtype"
                        @row-selected="tagTypeSelected"
                    />
                </div>
            </div>
            <div
                v-for="tagTypeUUID in Object.keys(tagValues)"
                :key="tagTypeUUID"
                class="q-mt-md row"
            >
                <MetadataFilterInput
                    :tag-type-uuid="tagTypeUUID"
                    :tag-lookup="tagLookup"
                    :tag-values="tagValues"
                    @update:tag-values="updateTagValues"
                />
            </div>
            <div class="q-mt-md row">
                <div class="col-10" />
                <div class="col-1">
                    <q-btn label="Close" color="orange" @click="onDialogHide" />
                </div>
                <div class="col-1">
                    <q-btn label="Apply" color="primary" @click="applyAction" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { DataType } from '@common/enum';
import MetadataFilterInput from 'components/metadata-filter-input.vue';
import MetadataTypeTable from 'components/metadata-type-table.vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { useAllTags } from 'src/hooks/query-hooks';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();

// Modern type-safe interface for tag filter values
interface TagFilterValue {
    name: string;
    value: string | number | boolean | Date | undefined;
}

type TagFilter = Record<string, TagFilterValue>;

const properties = defineProps<{
    tagValues?: TagFilter;
}>();

const tagtype = ref<string>('');
const tagValues = ref<TagFilter>(properties.tagValues ? { ...properties.tagValues } : {});

// Modern, type-safe conversion with proper error handling
const convertedTagValues = computed((): TagFilter => {
    const converted: TagFilter = {};
    
    Object.entries(tagValues.value).forEach(([key, filterValue]) => {
        const tagType = tagLookup.value[key];
        
        // Skip if tag type not found or value is invalid
        if (!tagType || !filterValue) {
            return;
        }
        
        const { value, name } = filterValue;
        
        // Skip empty values
        if (value === undefined || value === null || value === '') {
            return;
        }
        
        let convertedValue: string | number | boolean | Date | undefined;
        
        try {
            switch (tagType.datatype) {
                case DataType.BOOLEAN: {
                    // Boolean values should already be boolean type
                    if (typeof value === 'boolean') {
                        convertedValue = value;
                    } else if (typeof value === 'string') {
                        convertedValue = value.toLowerCase() === 'true';
                    } else {
                        return; // Invalid boolean value
                    }
                    break;
                }
                case DataType.NUMBER: {
                    const numValue = typeof value === 'number' 
                        ? value 
                        : Number.parseFloat(String(value));
                    
                    if (Number.isNaN(numValue)) {
                        return; // Invalid number, skip this filter
                    }
                    convertedValue = numValue;
                    break;
                }
                case DataType.DATE: {
                    // Handle both Date objects and date strings
                    if (value instanceof Date) {
                        convertedValue = value;
                    } else {
                        const dateValue = new Date(String(value));
                        if (isNaN(dateValue.getTime())) {
                            return; // Invalid date, skip this filter
                        }
                        convertedValue = dateValue;
                    }
                    break;
                }
                default: {
                    // STRING, LOCATION, LINK, ANY - keep as string
                    convertedValue = String(value);
                }
            }
            
            // Only add if we have a valid converted value
            if (convertedValue !== undefined && convertedValue !== null) {
                converted[key] = {
                    value: convertedValue,
                    name: name || tagType.name,
                };
            }
        } catch (error) {
            // Silently skip invalid conversions to prevent errors
            console.warn(`Failed to convert tag filter value for ${name}:`, error);
        }
    });
    
    return converted;
});

const { data } = useAllTags();

const tagLookup = computed(() => {
    const lookup: Record<string, TagTypeDto> = {};
    for (const tag of data.value ?? []) {
        lookup[tag.uuid] = tag;
    }
    return lookup;
});

const columns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: 'name',
    },
    {
        name: 'datatype',
        required: true,
        label: 'Datatype',
        align: 'left',
        field: 'type',
    },
];

// Modern, type-safe tag selection handler
const tagTypeSelected = (row: TagTypeDto): void => {
    if (!row?.uuid) {
        return;
    }
    
    // Use modern object property check instead of hasOwnProperty
    if (!(row.uuid in tagValues.value)) {
        tagValues.value[row.uuid] = { 
            value: undefined, 
            name: row.name 
        };
    }
};

// Type-safe tag values update handler
const updateTagValues = (newTagValues: TagFilter): void => {
    if (newTagValues && typeof newTagValues === 'object') {
        tagValues.value = { ...newTagValues };
    }
};

// Apply action with validation
const applyAction = (): void => {
    const converted = convertedTagValues.value;
    
    // Only apply if there are valid filters
    if (Object.keys(converted).length > 0 || Object.keys(tagValues.value).length === 0) {
        onDialogOK(converted);
    } else {
        // If conversion resulted in empty but we had inputs, show warning
        $q.notify({
            type: 'warning',
            message: 'Please enter valid filter values',
            position: 'top',
        });
    }
};
</script>
