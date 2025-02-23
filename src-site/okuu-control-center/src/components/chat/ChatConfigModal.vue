<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-md full-width">
      <div class="q-pa-md">
        <Zoom/>
        <q-toggle v-model="stream" label="Streamed Messages" :color="stream ? 'primary' : 'red'" />
      </div>

      <q-card-actions align="right">
        <q-btn color="primary" label="OK" @click="onOKClick" />
        <q-btn color="primary" label="Cancel" @click="onCancelClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import Zoom from 'src/components/settings/Zoom.vue';
import { useConfigStore } from 'src/stores/config.store';

defineEmits([
    ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const configStore = useConfigStore();
const stream = ref(configStore.stream);

const onOKClick = () => {
    configStore.setStream(stream.value);
    onDialogOK();
};

const onCancelClick = () => {
    onDialogCancel();
};
</script>

<style lang="scss" scoped>
</style>