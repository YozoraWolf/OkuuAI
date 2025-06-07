<template>
  <div>
    <q-input 
    v-model="systemPrompt" 
    label="System Prompt" 
    type="textarea"
    rows="8"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
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

watch(systemPrompt, (newValue, oldValue) => {
  // if oldValue was empty that means it was the initial fetch
  if (oldValue === '') {
    return;
  }
  // if the new value is the same as the current system prompt, do nothing
  if (newValue === configStore.systemPrompt) {
    return;
  }
  // otherwise, update the system prompt
  updateSystemPrompt(newValue);
});

onMounted(async () => {
  await fetchSystemPrompt();
});
</script>

<style scoped>
</style>
