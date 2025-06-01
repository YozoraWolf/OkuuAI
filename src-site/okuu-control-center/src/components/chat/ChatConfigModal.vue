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
import { ref, onMounted, watch } from 'vue';
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
const editedPrompt = ref('');

const onPromptEdited = (newPrompt: string) => {
  editedPrompt.value = newPrompt;
};

const saveConfig = async () => {
  if (editedPrompt.value.length > 0) {
    const confirm = await $q.dialog({
      title: 'Confirm',
      message: 'You have edited the system prompt. Do you want to save the changes?',
      cancel: true,
      persistent: true
    }).onOk(async () => {
      isSaving.value = true;
      try {
        configStore.setStream(stream.value);
        await configStore.updateSystemPrompt(editedPrompt.value);
        await configStore.updateGlobalMemory(globalMemory.value);
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
  } else {
    isSaving.value = true;
    try {
      configStore.setStream(stream.value);
      await configStore.updateSystemPrompt(configStore.systemPrompt);
      await configStore.updateGlobalMemory(globalMemory.value);
      onDialogOK();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      isSaving.value = false;
    }
  }
}

const onCancelClick = () => {
  if (editedPrompt.value !== undefined) {
    $q.dialog({
      title: 'Confirm',
      message: 'You have unsaved changes. Are you sure you want to cancel?',
      cancel: true,
      persistent: true
    }).onOk(() => {
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
};

const fetchGlobalMemory = async () => {
  await configStore.fetchGlobalMemory();
};

// watch

watch(() => configStore.stream, (newStream) => {
  stream.value = newStream;
});

watch(() => configStore.globalMemory, (newGlobalMemory) => {
  globalMemory.value = newGlobalMemory;
});

onMounted(async () => {
  isLoadingConfigs.value = true;
  await fetchOriginalPrompt();
  await fetchGlobalMemory();
  isLoadingConfigs.value = false;
});
</script>

<style lang="scss" scoped></style>