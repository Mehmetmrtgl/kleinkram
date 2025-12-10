<template>
    <title-section title="Datatable" />

    <div class="row q-col-gutter-sm q-mb-sm q-pt-md">
        
        <div class="col-4">
            <div class="row no-wrap items-center">
                <q-input
                    v-model="startDates"
                    filled
                    dense
                    outlined
                    clearable
                    placeholder="Start Date"
                    class="col"
                    bg-color="white"
                    @clear="resetStartDate"
                >
                    <template #prepend>
                        <q-icon name="sym_o_event" class="cursor-pointer">
                            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                                <q-date v-model="startDates" :mask="dateMask">
                                    <div class="row items-center justify-end">
                                        <q-btn v-close-popup label="Close" color="primary" flat />
                                    </div>
                                </q-date>
                            </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>

                <div class="q-px-sm text-grey-7">-</div>

                <q-input
                    v-model="endDates"
                    filled
                    dense
                    outlined
                    clearable
                    placeholder="End Date"
                    class="col"
                    bg-color="white"
                    @clear="resetEndDate"
                >
                    <template #prepend>
                        <q-icon name="sym_o_event" class="cursor-pointer">
                            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                                <q-date v-model="endDates" :mask="dateMask">
                                    <div class="row items-center justify-end">
                                        <q-btn v-close-popup label="Close" color="primary" flat />
                                    </div>
                                </q-date>
                            </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>
            </div>
        </div>

        <div class="col-4">
            <q-btn-dropdown
                v-model="dd_open_projects"
                :label="selected_project?.name || 'Filter by Project'"
                dense
                flat
                class="full-width custom-input-btn text-left"
                align="left"
                no-caps
            >
                <q-list>
                    <q-item
                        v-for="project in projects"
                        :key="project.uuid"
                        clickable
                        @click="
                            () => {
                                handler.setProjectUUID(project.uuid);
                                dd_open_projects = false;
                            }
                        "
                    >
                        <q-item-section>
                            <q-item-label>{{ project.name }}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
        </div>

        <div class="col-4">
            <q-tooltip v-if="!handler.projectUuid" self="bottom middle">
                Please select a project first
            </q-tooltip>
            <q-btn-dropdown
                v-model="dd_open_missions"
                :label="selected_mission?.name || 'Filter by Mission'"
                dense
                flat
                class="full-width custom-input-btn"
                align="left"
                no-caps
                :disable="!handler.projectUuid"
            >
                <q-list>
                    <q-item
                        v-for="mission in missions"
                        :key="mission.uuid"
                        clickable
                        @click="
                            () => {
                                handler.setMissionUUID(mission.uuid);
                                dd_open_missions = false;
                            }
                        "
                    >
                        <q-item-section>
                            <q-item-label>{{ mission.name }}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
        </div>
    </div>

    <div class="row q-col-gutter-sm q-mb-md">
        
        <div class="col-2">
            <file-type-selector
                ref="fileTypeSelectorReference"
                v-model="fileTypeFilter"
                class="full-width"
            />
        </div>

        <div class="col-2">
            <q-input
                v-model="filter"
                outlined
                dense
                debounce="300"
                clearable
                placeholder="Filter by Filename"
                class="full-width"
                bg-color="white"
            />
        </div>

        <div class="col-4">
            <div class="row no-wrap">
                <q-select
                    v-model="selectedTopics"
                    label="Select Topics"
                    use-input
                    input-debounce="20"
                    outlined
                    dense
                    clearable
                    multiple
                    use-chips
                    :options="displayedTopics"
                    emit-value
                    map-options
                    class="col"
                    bg-color="white"
                    @filter="filterFunction"
                    @popup-show="refetchTopics"
                />
                <q-btn-dropdown
                    dense
                    flat
                    class="custom-input-btn q-ml-sm"
                    style="width: 80px;"
                    no-caps
                >
                    <template #label>
                        {{ matchAllTopics ? 'And' : 'Or' }}
                    </template>
                    <q-list>
                        <q-item
                            v-for="(item, index) in ['And', 'Or']"
                            :key="index"
                            clickable
                            @click="() => (matchAllTopics = item === 'And')"
                        >
                            <q-item-section>
                                {{ item }}
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </div>
        </div>

        <div class="col-3">
            <q-btn
                v-if="hasActiveTagFilters"
                flat
                text-color="black"
                color="primary"
                label="Tags"
                icon="sym_o_sell"
                class="full-width custom-input-btn"
                align="left"
                no-caps
                @click="openTagFilterDialog"
            >
                <q-chip
                    v-for="(value, index) in activeTagFilters"
                    :key="`${value.name}-${index}`"
                    dense
                    class="q-ma-none q-mr-xs"
                    size="sm"
                >
                    {{ value.name }}: {{ formatTagValue(value.value) }}
                </q-chip>
            </q-btn>
            <q-btn
                v-else
                flat
                text-color="black"
                color="primary"
                label="Tags"
                icon="sym_o_sell"
                class="full-width custom-input-btn"
                align="left"
                no-caps
                @click="openTagFilterDialog"
            />
        </div>

        <div class="col-1">
            <q-btn
                flat
                text-color="black"
                icon="sym_o_clear"
                class="full-width custom-input-btn"
                @click="resetFilter"
            >
                <q-tooltip>Reset</q-tooltip>
            </q-btn>
        </div>
    </div>

    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        separator="none"
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        :rows="data"
        :columns="columns as any"
        row-key="uuid"
        :loading="loading"
        selection="multiple"
        binary-state-sort
        @row-click="onRowClick"
        @request="setPagination"
    >
        <template #body-selection="props">
            <q-checkbox
                v-model="props.selected"
                color="grey-8"
                class="checkbox-with-hitbox"
            />
        </template>
        <template #body-cell-state="props">
            <q-td :props="props">
                <q-icon
                    :name="getIcon(props.row.state)"
                    :color="getColorFileState(props.row.state)"
                    size="20px"
                >
                    <q-tooltip>{{ getTooltip(props.row.state) }}</q-tooltip>
                </q-icon>
            </q-td>
        </template>
        <template #body-cell-action="props">
            <q-td :props="props">
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_more_vert"
                    unelevated
                    color="primary"
                    class="cursor-pointer"
                    @click.stop
                >
                    <q-menu auto-close>
                        <q-list>
                            <edit-file-dialog-opener :file="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>Edit File</q-item-section>
                                </q-item>
                            </edit-file-dialog-opener>
                            <q-item
                                v-ripple
                                clickable
                                @click="() => onRowClick(undefined, props.row)"
                            >
                                <q-item-section>View File</q-item-section>
                            </q-item>
                            <q-item v-ripple clickable>
                                <q-item-section>
                                    <DeleteFileDialogOpener
                                        v-if="props.row"
                                        :file="props.row"
                                    >
                                        Delete File
                                    </DeleteFileDialogOpener>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { QTable, useQuasar } from 'quasar';
import { computed, Ref, ref, watch } from 'vue';

import { FileWithTopicDto } from '@api/types/file/file.dto';
import { FilesDto } from '@api/types/file/files.dto';
import { FlatMissionDto } from '@api/types/mission/mission.dto';
import TagFilter from 'src/dialogs/tag-filter.vue';
import {
    useFilteredProjects,
    useHandler,
    useMissionsOfProjectMinimal,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { dateMask, formatDate, parseDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { getColorFileState, getIcon, getTooltip } from 'src/services/generic';
import { fetchFilteredFiles } from 'src/services/queries/file';
import { allTopicsNames } from 'src/services/queries/topic';
import { useRouter } from 'vue-router';

import { ProjectWithMissionCountDto } from '@api/types/project/project-with-mission-count.dto';
import { FileType } from '@common/enum';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import EditFileDialogOpener from 'components/button-wrapper/edit-file-dialog-opener.vue';
import FileTypeSelector, {
    FileTypeOption,
} from 'components/file-type-selector.vue';
import TitleSection from 'components/title-section.vue';

const $router = useRouter();

const $q = useQuasar();
const tableReference: Ref<QTable | undefined> = ref(undefined);

const handler = useHandler();
handler.value.sortBy = 'file.createdAt';
handler.value.descending = true;

const loading = ref(false);
const filter = ref('');

const start = new Date(0);
const end = new Date();
const startDates = ref(formatDate(start));
const endDates = ref(formatDate(end));

const fileTypeFilter = ref<FileTypeOption[] | undefined>(undefined);
const fileTypeSelectorReference = ref<
    | {
          setAll?: (value: boolean) => void;
      }
    | undefined
>(undefined);

const selected_project = computed(() =>
    projects.value.find(
        (project: ProjectWithMissionCountDto) =>
            project.uuid === handler.value.projectUuid,
    ),
);

const selected_mission = computed(() =>
    missions.value.find(
        (mission: FlatMissionDto) => mission.uuid === handler.value.missionUuid,
    ),
);

const dd_open_projects = ref(false);
const dd_open_missions = ref(false);
const selected = ref([]);

// Fetch projects
const projectsReturn = useFilteredProjects(500, 0, 'name', false);
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value.data : [],
);

// Fetch missions
const { data: _missions } = useMissionsOfProjectMinimal(
    (handler.value.projectUuid || '') as string,
    500,
    0,
);
const missions = computed(() => (_missions.value ? _missions.value.data : []));

// Fetch topics
// BURADA DEĞİŞİKLİK YAPILDI: refetchTopics eklendi
const { data: allTopics, refetch: refetchTopics } = useQuery<string[]>({
    queryKey: ['topics'],
    queryFn: allTopicsNames,
});
const displayedTopics = ref(allTopics.value);
const selectedTopics = ref([]);

// Watcher ensures displayedTopics is updated when allTopics changes (e.g. after refetch)
watch(allTopics, (newVal: string[] | undefined) => {
    if (newVal) displayedTopics.value = newVal;
}, { immediate: true });

const matchAllTopics = ref(false);

// Modern type-safe tag filter structure
interface TagFilterValue {
    name: string;
    value: string | number | boolean | Date | undefined;
}

type TagFilter = Record<string, TagFilterValue>;

const tagFilter: Ref<TagFilter> = ref({});

end.setHours(23, 59, 59, 999);

const startDate = computed(() => parseDate(startDates.value));
const endDate = computed(() => parseDate(endDates.value));

const selectedFileTypesFilter = computed<FileType[]>(() => {
    const list = fileTypeFilter.value ?? [];
    return list
        .filter((option: FileTypeOption) => option.value)
        .map((option: FileTypeOption) => option.name) as FileType[];
});

const pagination = computed(() => {
    return {
        page: handler.value.page,
        rowsPerPage: handler.value.take,
        rowsNumber: handler.value.rowsNumber,
        sortBy: handler.value.sortBy,
        descending: handler.value.descending,
    };
});

function setPagination(update: {
    filter?: any;
    pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
    };
    getCellValue: any;
}) {
    handler.value.setPage(update.pagination.page);
    handler.value.setTake(update.pagination.rowsPerPage);
    handler.value.setSort(update.pagination.sortBy);
    handler.value.setDescending(update.pagination.descending);
}

const queryKeyFiles = computed(() => [
    'Filtered Files',
    handler.value.projectUuid,
    handler.value.missionUuid,
    filter,
    startDate,
    endDate,
    selectedTopics,
    matchAllTopics,
    tagFilter,
    selectedFileTypesFilter,
    handler.value.queryKey,
]);

// Modern, type-safe tag filter query builder
const tagFilterQuery = computed(() => {
    const query: Record<string, any> = {};
    
    Object.entries(tagFilter.value).forEach(([key, filterValue]) => {
        // Only include entries with valid values - type guard ensures filterValue is TagFilterValue
        if (filterValue && typeof filterValue === 'object' && 'value' in filterValue) {
            const value = filterValue.value;
            if (value !== undefined && value !== null && value !== '') {
                query[key] = value;
            }
        }
    });
    
    return query;
});

const { data: _data, isLoading }: UseQueryReturnType<FilesDto, Error> =
    useQuery<FilesDto>({
        queryKey: queryKeyFiles,
        queryFn: () =>
            fetchFilteredFiles(
                filter.value,
                handler.value.projectUuid,
                handler.value.missionUuid,
                startDate.value,
                endDate.value,
                selectedTopics.value ?? [],
                [],
                matchAllTopics.value,
                selectedFileTypesFilter.value ?? ([] as FileType[]),
                tagFilterQuery.value,
                handler.value.take,
                handler.value.skip,
                handler.value.sortBy,
                handler.value.descending,
            ),
    });
const data = computed(() => (_data.value ? _data.value.data : []));
const total = computed(() => (_data.value ? _data.value.count : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            handler.value.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const columns = [
    {
        name: 'state',
        required: true,
        label: 'Health',
        style: 'width: 10px',
        align: 'center',
        sortable: true,
    },
    {
        name: 'project.name',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: FileWithTopicDto) => row.mission.project.name,
        format: (value: string) => value,
        sortable: false,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'mission.name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileWithTopicDto) => row.mission.name,
        format: (value: string) => value,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.filename',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileWithTopicDto) => row.filename,
        format: (value: string) => value,
        sortable: true,
        style: 'width:  15%; max-width:  15%; min-width: 15%;',
    },
    {
        name: 'file.date',
        required: true,
        label: 'Recoring Date',
        align: 'left',
        field: (row: FileWithTopicDto) => row.date,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'file.createdAt',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FileWithTopicDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileWithTopicDto) => row.creator.name,
        format: (value: string) => value,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileWithTopicDto) => row.size,
        format: formatSize,
        sortable: true,
    },
    {
        name: 'action',
        required: true,
        label: '',
        align: 'center',
        field: 'Edit',
    },
];

// Computed properties for better reactivity and type safety
const hasActiveTagFilters = computed(() => {
    const values = Object.values(tagFilter.value) as TagFilterValue[];
    return values.length > 0 && 
           values.some((v) => 
               v && typeof v === 'object' && 'value' in v && v.value !== undefined && v.value !== null && v.value !== ''
           );
});

const activeTagFilters = computed(() => {
    const values = Object.values(tagFilter.value) as TagFilterValue[];
    return values.filter((v): v is TagFilterValue => 
        v !== undefined && typeof v === 'object' && 'value' in v && v.value !== undefined && v.value !== null && v.value !== ''
    );
});

// Helper function to format tag values for display
function formatTagValue(value: string | number | boolean | Date | undefined): string {
    if (value === undefined || value === null) return '';
    if (value instanceof Date) return formatDate(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
}

function openTagFilterDialog() {
    $q.dialog({
        title: 'Filter by Metadata',
        component: TagFilter,
        componentProps: {
            tagValues: { ...tagFilter.value }, // Create a copy to avoid mutations
        },
    }).onOk((newTagFilter: TagFilter) => {
        // Validate and set the new filter
        if (newTagFilter && typeof newTagFilter === 'object') {
            tagFilter.value = newTagFilter;
        }
    }).onCancel(() => {
        // Dialog was cancelled, no changes needed
    });
}

function filterFunction(value: string, update: any) {
    if (value === '') {
        update(() => {
            displayedTopics.value = allTopics.value;
        });
        return;
    }
    update(() => {
        if (!allTopics.value) return;
        const needle = value.toLowerCase();
        displayedTopics.value = allTopics.value.filter((v: string) =>
            v.toLowerCase().includes(needle),
        );
    });
}

const onRowClick = async (_: any, row: any) => {
    await $router.push({
        name: ROUTES.FILE.routeName,
        params: {
            file_uuid: row.uuid,
            missionUuid: row.mission.uuid,
            projectUuid: row.mission.project.uuid,
        },
    });
};

function resetStartDate() {
    startDates.value = formatDate(start);
}

function resetEndDate() {
    endDates.value = formatDate(end);
}

function resetFilter() {
    handler.value.setProjectUUID(undefined);
    handler.value.setMissionUUID(undefined);
    handler.value.setSearch({ name: '' });
    filter.value = '';
    selectedTopics.value = [];
    matchAllTopics.value = false;
    // On reset select all file types via component API if available
    if (
        fileTypeSelectorReference.value &&
        typeof fileTypeSelectorReference.value.setAll === 'function'
    ) {
        fileTypeSelectorReference.value.setAll(true);
    } else if (fileTypeFilter.value) {
        fileTypeFilter.value = fileTypeFilter.value.map((it: FileTypeOption) => ({
            ...it,
            value: true,
        }));
    }
    tagFilter.value = {} as TagFilter;
    resetStartDate();
    resetEndDate();
}
</script>

<style scoped>
/* BU CSS SINIFI TÜM BUTONLARI INPUT GİBİ GÖSTERİR */
.custom-input-btn {
    height: 40px; /* Standart Dense Input Yüksekliği */
    border: 1px solid rgba(0, 0, 0, 0.24); /* Quasar Outlined Rengi */
    border-radius: 4px; /* Quasar Radius */
    background: white;
}
</style>
