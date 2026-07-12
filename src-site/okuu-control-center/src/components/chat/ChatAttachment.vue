<template>
  <input ref="fileInput" class="file-input" type="file" accept="image/*,.txt,.pdf,.doc,.docx,.csv,.json" @change="onFileSelected" />
  <q-btn v-if="modelValue" flat round dense icon="close" aria-label="Remove attachment" @click="removeAttachment">
    <q-tooltip>Remove all attachments</q-tooltip>
  </q-btn>
  <q-btn v-else flat round dense type="button" icon="attach_file" :disable="disable" aria-label="Attach file" @click.stop="openPicker">
    <q-tooltip>Attach a document</q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ modelValue: File | null; disable?: boolean; }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: File | null): void; }>();
const fileInput = ref<HTMLInputElement>();

const openPicker = () => {
  const input = fileInput.value;
  if (!input) return;
  try {
    input.showPicker();
  } catch {
    input.click();
  }
};
const onFileSelected = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0] || null;
  emit('update:modelValue', file);
};
const removeAttachment = () => {
  if (fileInput.value) fileInput.value.value = '';
  emit('update:modelValue', null);
};
</script>

<style scoped>
.file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
