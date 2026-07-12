<template>
    <div class="zoom-control">
        <div class="zoom-label"><span>Interface scale</span><strong>{{ zoomLevel }}%</strong></div>
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
        <q-btn v-if="zoomLevel !== initialZoomLevel" unelevated no-caps label="Apply scale" class="apply-zoom" @click="applyZoomLevel" />
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

<style lang="scss" scoped>
.zoom-control { display: flex; max-width: 420px; flex-direction: column; gap: 0.8rem; }
.zoom-label { display: flex; align-items: center; justify-content: space-between; color: var(--text-muted); font-size: 0.85rem; }
.zoom-label strong { color: var(--text-strong); }
.apply-zoom { align-self: flex-start; border-radius: 9px; color: var(--accent-text); background: var(--accent-1); font-weight: 700; }
</style>
