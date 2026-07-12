<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card v-if="isLoadingConfigs" class="flex flex-center q-pa-md full-width">
      <q-spinner size="50" color="primary" />
    </q-card>
    <q-card v-else class="q-dialog-plugin q-pa-md full-width">
      <div class="q-pa-md">
        <Zoom />
        <div class="column">
          <q-toggle v-model="stream" class="col-5" label="Streamed Messages" :color="stream ? 'primary' : 'grey'" />
          <div class="row items-center">
            <q-toggle v-model="globalMemory" class="col-4" label="Global Memory"
              :color="globalMemory ? 'primary' : 'grey'" />
            <q-icon name="mdi-information" size="xs">
              <q-tooltip class="bg-grey-9">
                  <div class="text-body1">Global Memory</div>
                  <div>When enabled, the system will search all memories from all sessions.</div>
              </q-tooltip>
            </q-icon>
          </div>
        </div>
        <div class="message-style">
          <div class="style-title">Message layout</div>
          <div class="style-options">
            <button class="style-option" :class="{ active: configStore.messageStyle === 'transcript' }" @click="configStore.setMessageStyle('transcript')">
              <span class="style-preview transcript-preview"><i></i><i></i><i></i></span>
              <strong>Transcript</strong><small>Compact, continuous reading</small>
            </button>
            <button class="style-option" :class="{ active: configStore.messageStyle === 'bubbles' }" @click="configStore.setMessageStyle('bubbles')">
              <span class="style-preview bubble-preview"><i></i><i></i><i></i></span>
              <strong>Bubbles</strong><small>Separated speaker messages</small>
            </button>
          </div>
        </div>
        <SystemPromptEdit @prompt-edited="onPromptEdited" />
        <GlobalToggles class="q-mt-md" />
      </div>

      <q-card-actions align="right">
        <q-btn :loading="isSaving" color="primary" label="Save" @click="saveConfig" />
        <q-btn color="primary" :disable="isSaving" label="Cancel" @click="onCancelClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import Zoom from 'src/components/settings/Zoom.vue';
import SystemPromptEdit from 'src/components/settings/SystemPromptEdit.vue';
import GlobalToggles from 'src/components/settings/GlobalToggles.vue';
import { useConfigStore } from 'src/stores/config.store';

defineEmits([
  ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const $q = useQuasar();

const configStore = useConfigStore();

const stream = ref(configStore.stream);
const globalMemory = ref(configStore.globalMemory);
const isSaving = ref(false);
const isLoadingConfigs = ref(false);
let originalPrompt = '';
let originalStream = configStore.stream;
let originalGlobalMemory = configStore.globalMemory;
const editedPrompt = ref();

const hasChanges = computed(() => {
  return (
    (editedPrompt.value !== undefined && editedPrompt.value !== originalPrompt) ||
    stream.value !== originalStream ||
    globalMemory.value !== originalGlobalMemory
  );
});


const onPromptEdited = (newPrompt: string) => {
  editedPrompt.value = newPrompt;
};

const saveConfig = async () => {
  if (!hasChanges.value) {
    onDialogOK();
    return;
  }
  const confirm = await $q.dialog({
    title: 'Confirm',
    message: 'You have unsaved changes. Do you want to save the changes?',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    isSaving.value = true;
    try {
      configStore.setStream(stream.value);
      await configStore.updateSystemPrompt(editedPrompt.value !== undefined ? editedPrompt.value : configStore.systemPrompt);
      await configStore.updateGlobalMemory(globalMemory.value);
      // Update originals
      originalPrompt = editedPrompt.value !== undefined ? editedPrompt.value : configStore.systemPrompt;
      originalStream = stream.value;
      originalGlobalMemory = globalMemory.value;
      onDialogOK();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      isSaving.value = false;
    }
  }).onCancel(() => false);

  if (!confirm) {
    return;
  }
};

const onCancelClick = () => {
  if (hasChanges.value) {
    $q.dialog({
      title: 'Confirm',
      message: 'You have unsaved changes. Are you sure you want to cancel?',
      cancel: true,
      persistent: true
    }).onOk(() => {
      // Reset changes
      stream.value = originalStream;
      globalMemory.value = originalGlobalMemory;
      editedPrompt.value = originalPrompt;
      onDialogCancel();
    });
  } else {
    onDialogCancel();
  }
};


const fetchOriginalPrompt = async () => {
  if (!configStore.systemPrompt) {
    await configStore.fetchSystemPrompt();
  }
  originalPrompt = configStore.systemPrompt;
  editedPrompt.value = configStore.systemPrompt;
};


const fetchGlobalMemory = async () => {
  await configStore.fetchGlobalMemory();
  originalGlobalMemory = configStore.globalMemory;
};


// watch
watch(() => configStore.stream, (newStream) => {
  stream.value = newStream;
  originalStream = newStream;
});
watch(() => configStore.globalMemory, (newGlobalMemory) => {
  globalMemory.value = newGlobalMemory;
  originalGlobalMemory = newGlobalMemory;
});

onMounted(async () => {
  isLoadingConfigs.value = true;
  await fetchOriginalPrompt();
  await fetchGlobalMemory();
  isLoadingConfigs.value = false;
});
</script>

<style lang="scss" scoped>
.message-style { margin: 1.2rem 0; padding-top: 1rem; border-top: 1px solid var(--surface-border); }
.style-title { margin-bottom: 0.65rem; font-weight: 700; }
.style-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }
.style-option { display: grid; gap: 0.35rem; padding: 0.7rem; border: 1px solid var(--surface-border); border-radius: 10px; color: var(--text-strong); text-align: left; cursor: pointer; background: var(--surface-2); }
.style-option.active { border-color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 12%, var(--surface-2)); }
.style-option small { color: var(--text-muted); font-size: 0.68rem; }
.style-preview { display: grid; gap: 3px; height: 30px; padding: 4px; border-radius: 6px; background: var(--surface-1); }
.style-preview i { display: block; height: 5px; border-radius: 4px; background: color-mix(in srgb, var(--accent-1) 55%, var(--surface-1)); }
.bubble-preview i:nth-child(2) { width: 62%; margin-left: auto; background: color-mix(in srgb, var(--accent-2) 55%, var(--surface-1)); }
</style>

<style lang="scss" scoped></style>
