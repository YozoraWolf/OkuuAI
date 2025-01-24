<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-md full-width">

    <div class="q-pa-md">
        <Zoom/>
    </div>


      <!-- buttons example -->
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

defineEmits([
    ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

// methods

const onOKClick = () => {
    onDialogOK();
};

const onCancelClick = () => {
    onDialogCancel();
};

const test = ref('test');
</script>

<style lang="scss" scoped>
</style>