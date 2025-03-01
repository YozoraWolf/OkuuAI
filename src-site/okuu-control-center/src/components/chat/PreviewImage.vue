<template>
    <q-dialog v-model="dialog" :max-width="800" @click-outside="closeDialog">
        <q-card class="q-dialog-plugin q-pa-md full-width">
            <div ref="canvasElement" class="panzoom-container">
                <q-img :src="imageSrc" style="max-width: 800px; max-height: 100vh;" />
            </div>
            <q-card-actions align="right">
                <q-btn flat label="Close" color="primary" @click="closeDialog" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { watch, ref, onMounted, onUnmounted } from 'vue';
import Panzoom from '@panzoom/panzoom';

const props = defineProps({
    imageSrc: { type: String, required: true },
    visible: { type: Boolean, default: false }
});

const emit = defineEmits(['close']);

const dialog = ref(false);
const canvasElement = ref<HTMLElement | null>(null);
let panzoomInstance: any = null; // Store the Panzoom instance

watch(() => props.visible, (newVal) => {
    console.log(newVal);
    if(newVal) {
        dialog.value = true;
    }
});

const closeDialog = () => {
    dialog.value = false;
    emit('close');
};

onMounted(() => {
    if (canvasElement.value) {
        panzoomInstance = Panzoom(canvasElement.value, {
            minScale: 1,
            maxScale: 2,
            contain: "outside",
        });

        canvasElement.value.addEventListener("wheel", panzoomInstance.zoomWithWheel);
    }
});

onUnmounted(() => {
    if (canvasElement.value && panzoomInstance) {
        canvasElement.value.removeEventListener("wheel", panzoomInstance.zoomWithWheel);
        panzoomInstance.destroy(); // Properly clean up Panzoom instance
    }
    emit('close');
});
</script>

<style scoped>
.panzoom-container {
    overflow: hidden;
    position: relative;
}
</style>
