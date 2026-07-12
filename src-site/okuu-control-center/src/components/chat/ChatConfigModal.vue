<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card v-if="isLoadingConfigs" class="settings-dialog loading-state">
      <q-spinner size="50" color="primary" />
    </q-card>
    <q-card v-else class="settings-dialog">
      <header class="dialog-header">
        <div class="header-mark"><q-icon name="tune" size="22px" /></div>
        <div class="header-copy">
          <h2>Chat settings</h2>
          <p>Adjust how conversations look and how Okuu responds.</p>
        </div>
        <q-btn flat round dense icon="close" aria-label="Close chat settings" @click="onCancelClick" />
      </header>

      <q-card-section class="settings-content">
        <section class="settings-section">
          <div class="section-heading">
            <span>Response behavior</span>
            <small>Control generation and memory</small>
          </div>
          <div class="setting-panel">
            <div class="setting-row">
              <div><strong>Stream responses</strong><span>Show replies as they are generated.</span></div>
              <q-toggle v-model="stream" color="primary" />
            </div>
            <div class="setting-row">
              <div><strong>Global memory</strong><span>Search memories from every conversation.</span></div>
              <q-toggle v-model="globalMemory" color="primary" />
            </div>
            <GlobalToggles class="reasoning-settings" />
          </div>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <span>Conversation layout</span>
            <small>Choose how messages are arranged</small>
          </div>
          <div class="style-options">
            <button class="style-option" :class="{ active: messageStyle === 'transcript' }" @click="messageStyle = 'transcript'">
              <span class="style-preview transcript-preview"><i></i><i></i><i></i></span>
              <span><strong>Transcript</strong><small>Compact, continuous reading</small></span>
              <q-icon v-if="messageStyle === 'transcript'" name="check_circle" class="selected-check" />
            </button>
            <button class="style-option" :class="{ active: messageStyle === 'bubbles' }" @click="messageStyle = 'bubbles'">
              <span class="style-preview bubble-preview"><i></i><i></i><i></i></span>
              <span><strong>Bubbles</strong><small>Separated speaker messages</small></span>
              <q-icon v-if="messageStyle === 'bubbles'" name="check_circle" class="selected-check" />
            </button>
          </div>
        </section>

        <section class="settings-section compact-section">
          <div class="section-heading">
            <span>Interface scale</span>
            <small>Resize the conversation interface</small>
          </div>
          <div class="setting-panel zoom-panel"><Zoom /></div>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <span>Assistant instructions</span>
            <small>Define Okuu's behavior and personality</small>
          </div>
          <div class="prompt-panel"><SystemPromptEdit @prompt-edited="onPromptEdited" /></div>
        </section>
      </q-card-section>

      <q-card-actions class="dialog-actions">
        <q-btn flat no-caps :disable="isSaving" label="Cancel" @click="onCancelClick" />
        <q-btn unelevated no-caps :loading="isSaving" color="primary" label="Save changes" @click="saveConfig" />
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
const messageStyle = ref(configStore.messageStyle);
const isSaving = ref(false);
const isLoadingConfigs = ref(false);
let originalPrompt = '';
let originalStream = configStore.stream;
let originalGlobalMemory = configStore.globalMemory;
let originalMessageStyle = configStore.messageStyle;
const editedPrompt = ref();

const hasChanges = computed(() => {
  return (
    (editedPrompt.value !== undefined && editedPrompt.value !== originalPrompt) ||
    stream.value !== originalStream ||
    globalMemory.value !== originalGlobalMemory ||
    messageStyle.value !== originalMessageStyle
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
  isSaving.value = true;
  try {
    configStore.setStream(stream.value);
    configStore.setMessageStyle(messageStyle.value);
    await configStore.updateSystemPrompt(editedPrompt.value !== undefined ? editedPrompt.value : configStore.systemPrompt);
    await configStore.updateGlobalMemory(globalMemory.value);
    onDialogOK();
  } catch (error) {
    console.error('Failed to save settings:', error);
  } finally {
    isSaving.value = false;
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
      messageStyle.value = originalMessageStyle;
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
  originalMessageStyle = configStore.messageStyle;
  messageStyle.value = configStore.messageStyle;
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
.settings-dialog { display: flex; width: min(720px, calc(100vw - 2rem)); max-width: none; max-height: min(880px, calc(100dvh - 2rem)); flex-direction: column; overflow: hidden; border: 1px solid var(--surface-border); border-radius: 22px; background: var(--surface-1) !important; box-shadow: 0 28px 80px rgba(0,0,0,0.42); }
.loading-state { min-height: 260px; align-items: center; justify-content: center; }
.dialog-header { display: flex; align-items: center; gap: 0.85rem; padding: 1.15rem 1.25rem; border-bottom: 1px solid var(--surface-border); }
.header-mark { display: grid; width: 42px; height: 42px; flex: none; place-items: center; border-radius: 12px; color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 13%, transparent); }
.header-copy { min-width: 0; flex: 1; }
.header-copy h2 { margin: 0; font-size: 1.08rem; letter-spacing: -0.025em; }
.header-copy p { margin: 0.2rem 0 0; color: var(--text-muted); font-size: 0.76rem; }
.settings-content { display: grid; gap: 1.4rem; padding: 1.25rem; overflow-y: auto; }
.settings-section { display: grid; gap: 0.7rem; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 0 0.1rem; }
.section-heading span { font-size: 0.84rem; font-weight: 800; }
.section-heading small { color: var(--text-muted); font-size: 0.68rem; }
.setting-panel, .prompt-panel { overflow: hidden; border: 1px solid var(--surface-border); border-radius: 14px; background: color-mix(in srgb, var(--surface-2) 70%, transparent); }
.setting-row { display: flex; height: 68px; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 0.9rem; border-bottom: 1px solid var(--surface-border); box-sizing: border-box; }
.setting-row strong, .setting-row span { display: block; }
.setting-row strong { font-size: 0.82rem; }
.setting-row span { margin-top: 0.15rem; color: var(--text-muted); font-size: 0.7rem; }
.reasoning-settings { gap: 0 !important; padding: 0; }
.reasoning-settings :deep(.toggle-item) { height: 68px; min-height: 68px; padding: 0.75rem 0.9rem; box-sizing: border-box; }
.reasoning-settings :deep(.toggle-item span) { max-width: none; }
.reasoning-settings :deep(.toggle-item + .toggle-item) { border-top: 1px solid var(--surface-border); }
.style-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }
.style-option { position: relative; display: grid; grid-template-columns: 72px 1fr; align-items: center; gap: 0.7rem; min-height: 76px; padding: 0.7rem; border: 1px solid var(--surface-border); border-radius: 14px; color: var(--text-strong); text-align: left; cursor: pointer; background: color-mix(in srgb, var(--surface-2) 70%, transparent); transition: border-color 150ms ease, background 150ms ease, transform 150ms ease; }
.style-option:hover { border-color: color-mix(in srgb, var(--accent-1) 38%, var(--surface-border)); transform: translateY(-1px); }
.style-option.active { border-color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 10%, var(--surface-2)); }
.style-option strong, .style-option small { display: block; }
.style-option strong { font-size: 0.8rem; }
.style-option small { margin-top: 0.18rem; color: var(--text-muted); font-size: 0.65rem; }
.style-preview { display: grid; gap: 4px; height: 46px; padding: 7px; border-radius: 8px; background: var(--surface-1); }
.style-preview i { display: block; height: 5px; border-radius: 4px; background: color-mix(in srgb, var(--accent-1) 55%, var(--surface-1)); }
.bubble-preview i:nth-child(2) { width: 62%; margin-left: auto; background: color-mix(in srgb, var(--accent-2) 55%, var(--surface-1)); }
.selected-check { position: absolute; top: 7px; right: 7px; color: var(--accent-1); font-size: 16px; }
.zoom-panel { padding: 1rem 1.5rem 1.35rem; }
.zoom-panel :deep(.zoom-control) { max-width: none; }
.prompt-panel { padding: 0.9rem; }
.prompt-panel :deep(> div), .prompt-panel :deep(.q-field) { width: 100%; }
.prompt-panel :deep(.q-field__control) { width: 100%; min-height: 210px; border-radius: 10px; background: var(--surface-1); }
.prompt-panel :deep(textarea) { min-height: 170px !important; resize: vertical; line-height: 1.55; }
.dialog-actions { justify-content: flex-end; gap: 0.35rem; padding: 0.85rem 1.25rem; border-top: 1px solid var(--surface-border); background: color-mix(in srgb, var(--surface-1) 94%, transparent); }
.dialog-actions :deep(.q-btn) { min-width: 96px; border-radius: 10px; }

@media (max-width: 600px) {
  .settings-dialog { width: calc(100vw - 1rem); max-height: calc(100dvh - 1rem); border-radius: 16px; }
  .dialog-header, .settings-content, .dialog-actions { padding-left: 0.9rem; padding-right: 0.9rem; }
  .style-options { grid-template-columns: 1fr; }
  .section-heading small { display: none; }
  .zoom-panel { padding-right: 1.1rem; padding-left: 1.1rem; }
}
</style>
