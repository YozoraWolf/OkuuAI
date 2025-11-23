<template>
    <div class="flex self-end q-gutter-x-xs" v-if="visible">
        <q-btn v-if="canEdit" flat dense icon="edit" size="md" color="grey-7" @click="$emit('edit')">
            <q-tooltip>Edit</q-tooltip>
        </q-btn>
        <q-btn v-if="canDelete" flat dense icon="mdi-trash-can" size="md" color="red-5" @click="$emit('delete')">
            <q-tooltip>Delete</q-tooltip>
        </q-btn>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    visible: boolean;
    canDelete?: boolean;
    canEdit?: boolean;
}>();

defineEmits<{
    (e: 'delete'): void;
    (e: 'edit'): void;
}>();
</script>
