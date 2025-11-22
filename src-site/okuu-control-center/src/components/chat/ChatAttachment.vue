<template>
    <q-file :disable="disable" v-model="model"
        accept=".txt, .pdf, .doc, .docx, .csv, .json"
        @update:model-value="onFileSelected"
        dense outlined class="q-ml-sm" style="max-width: 200px;">
        <template v-slot:prepend>
            <q-icon name="attach_file" />
            <q-icon v-if="model" name="close" @click.stop="removeAttachment" class="cursor-pointer" />
        </template>
    </q-file>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    modelValue: File | null;
    disable?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: File | null): void;
}>();

const model = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
});

const removeAttachment = () => {
    model.value = null;
};

const onFileSelected = (file: File | null) => {
    // Optional: Add any validation or processing here
};
</script>
