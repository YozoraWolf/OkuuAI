<template>
  <q-dialog v-model="show" persistent>
    <q-card>
      <q-card-section>
        <div class="text-h6">Microphone Consent</div>
        <div>
          To use audio input, we need your consent to access your microphone. This will be remembered for future sessions.
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup @click="onCancel" />
        <q-btn flat label="Allow" color="primary" @click="onAllow" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, defineEmits, defineProps } from 'vue';

const props = defineProps({
  modelValue: Boolean
});
const emit = defineEmits(['update:modelValue', 'consent']);

const show = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
  show.value = val;
});
watch(show, (val) => {
  emit('update:modelValue', val);
});

function onAllow() {
  emit('consent');
  show.value = false;
}
function onCancel() {
  show.value = false;
}
</script>
