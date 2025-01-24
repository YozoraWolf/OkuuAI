<template>
    <div class="q-my-md flex column" style="width: 400px;">
        <label for="zoom">Zoom Level: {{ zoomLevel }}%</label>
        <q-slider 
            v-model="zoomLevel" 
            :min="50" 
            :max="200" 
            :step="10" 
            label 
            label-always 
            class="q-mt-md"
            :marker-labels="markedZoomLevels"
            track-color="grey-6"
        />
        <q-btn v-if="zoomLevel !== initialZoomLevel" label="Apply" color="primary" class="q-mt-md" @click="applyZoomLevel" />
    </div>
</template>

<script setup lang="ts">
import { useConfigStore } from 'src/stores/config.store';
import { ref, watch } from 'vue';

const configStore = useConfigStore();

const initialZoomLevel = ref(configStore.getZoomLevel());
const zoomLevel = ref(initialZoomLevel.value);
const markedZoomLevels = ref({
    50: '50%',
    100: '100%',
    150: '150%',
    200: '200%',
});

const applyZoomLevel = () => {
    configStore.setZoomLevel(zoomLevel.value);
    initialZoomLevel.value = zoomLevel.value;
};

watch(() => configStore.getZoomLevel(), (newZoomLevel) => {
    initialZoomLevel.value = newZoomLevel;
    zoomLevel.value = newZoomLevel;
});
</script>

<style scoped>

</style>
