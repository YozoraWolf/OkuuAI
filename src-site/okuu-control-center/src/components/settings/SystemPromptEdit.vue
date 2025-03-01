<template>
  <div>
    <q-input 
    v-model="systemPrompt" 
    label="System Prompt" 
    type="textarea"
    rows="8"
    @update:model-value="updateSystemPrompt" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useConfigStore } from 'src/stores/config.store';

const configStore = useConfigStore();
const systemPrompt = ref('');
const emit = defineEmits(['prompt-edited']);

const fetchSystemPrompt = async () => {
  try {
    if (!configStore.systemPrompt) {
      await configStore.fetchSystemPrompt();
    }
    systemPrompt.value = configStore.systemPrompt;
  } catch (error) {
    console.error('Failed to fetch system prompt:', error);
  }
};

const updateSystemPrompt = (value: string | number | null) => {
  if (typeof value !== 'string') {
    return;
  }
  if(systemPrompt.value === configStore.systemPrompt) {
    return;
  }
  emit('prompt-edited', value);
};

onMounted(async () => {
  await fetchSystemPrompt();
});
</script>

<style scoped>
</style>
