<template>
    <q-dialog v-model="dialog" maximized transition-show="fade" transition-hide="fade" @hide="closeDialog">
        <div class="media-viewer-container bg-black text-white relative-position flex flex-center full-width full-height"
            @click.self="closeDialog">

            <!-- Close Button -->
            <q-btn icon="close" flat round dense class="absolute-top-right q-ma-md z-max" @click="closeDialog" />

            <!-- Main Content -->
            <div class="media-content relative-position" @click.stop>
                <!-- Image Viewer with Pan/Zoom -->
                <div v-if="type === 'image'" ref="canvasElement" class="panzoom-container flex flex-center">
                    <img :src="src" class="media-element" style="max-height: 90vh; max-width: 90vw;" />
                </div>

                <!-- Video Player -->
                <div v-else-if="type === 'video'" class="flex flex-center">
                    <video controls autoplay class="media-element" style="max-height: 90vh; max-width: 90vw;">
                        <source :src="src">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>

            <!-- Action Buttons (Bottom Center) -->
            <div class="absolute-bottom q-mb-lg flex flex-center q-gutter-md z-max">
                <q-btn v-if="metadata" round color="dark" text-color="white" icon="info" @click="showMetadata = true">
                    <q-tooltip>Metadata</q-tooltip>
                </q-btn>

                <q-btn v-if="sourceUrl" round color="dark" text-color="white" icon="open_in_new"
                    @click="openUrl(sourceUrl)">
                    <q-tooltip>Open Source</q-tooltip>
                </q-btn>

                <q-btn v-if="danbooruUrl" round color="dark" text-color="white" icon="link"
                    @click="openUrl(danbooruUrl)">
                    <q-tooltip>Open Danbooru</q-tooltip>
                </q-btn>

                <q-btn round color="dark" text-color="white" icon="download" @click="downloadMedia">
                    <q-tooltip>Download</q-tooltip>
                </q-btn>
            </div>

            <!-- Metadata Submodal -->
            <q-dialog v-model="showMetadata">
                <q-card style="min-width: 300px">
                    <q-card-section>
                        <div class="text-h6">Metadata</div>
                    </q-card-section>

                    <q-card-section class="q-pt-none">
                        <div v-if="metadata" class="column q-gutter-sm">
                            <div v-for="(value, key) in displayMetadata" :key="key">
                                <span class="text-weight-bold">{{ formatKey(String(key)) }}:</span>
                                <span class="q-ml-sm">{{ value }}</span>
                            </div>
                        </div>
                        <div v-else>
                            No metadata available.
                        </div>
                    </q-card-section>

                    <q-card-actions align="right">
                        <q-btn flat label="Close" color="primary" v-close-popup />
                    </q-card-actions>
                </q-card>
            </q-dialog>

        </div>
    </q-dialog>
</template>

<script setup lang="ts">
import { watch, ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import axios from 'axios';
import Panzoom from '@panzoom/panzoom';

const $q = useQuasar();

const props = defineProps({
    src: { type: String, required: true },
    type: { type: String, default: 'image' }, // 'image' or 'video'
    visible: { type: Boolean, default: false },
    metadata: { type: Object, default: null }
});

const emit = defineEmits(['close']);

const dialog = ref(false);
const showMetadata = ref(false);
const canvasElement = ref<HTMLElement | null>(null);
let panzoomInstance: any = null;

const sourceUrl = computed(() => props.metadata?.source || props.metadata?.url || null);
const danbooruUrl = computed(() => props.metadata?.danbooru || null);

const displayMetadata = computed(() => {
    if (!props.metadata) return {};
    const { source, danbooru, url, ...rest } = props.metadata;
    return rest;
});

const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

watch(() => props.visible, async (newVal) => {
    if (newVal) {
        dialog.value = true;
        if (props.type === 'image') {
            await nextTick();
            initPanzoom();
        }
    } else {
        dialog.value = false;
    }
});

const initPanzoom = () => {
    if (canvasElement.value) {
        // Destroy existing instance if any
        if (panzoomInstance) {
            panzoomInstance.destroy();
        }

        const elem = canvasElement.value.querySelector('img');
        if (elem) {
            panzoomInstance = Panzoom(elem as HTMLElement, {
                maxScale: 5,
                minScale: 0.5,
                contain: 'outside',
            });
            elem.parentElement?.addEventListener('wheel', panzoomInstance.zoomWithWheel);
        }
    }
};

const closeDialog = () => {
    dialog.value = false;
    emit('close');
};

const openUrl = (url: string) => {
    window.open(url, '_blank');
};

const downloadMedia = async () => {
    const notif = $q.notify({
        group: false, // required to be updatable
        timeout: 0,
        spinner: true,
        message: 'Downloading media...',
        caption: '0%',
        position: 'top',
        badgeStyle: 'display: none' // Hide the update badge counter
    });

    try {
        let lastPercent = 0;
        const response = await axios.get(props.src, {
            responseType: 'blob',
            onDownloadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    // Only update notification every 10% or when complete
                    if (percentCompleted - lastPercent >= 10 || percentCompleted === 100) {
                        lastPercent = percentCompleted;
                        notif({
                            caption: `${percentCompleted}%`
                        });
                    }
                }
            }
        });

        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Try to derive filename from URL or metadata, fallback to default
        let filename = `download.${props.type === 'video' ? 'mp4' : 'png'}`;
        if (props.src.startsWith('http')) {
            const urlParts = props.src.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart && lastPart.includes('.')) {
                filename = lastPart.split('?')[0] ?? filename; // Remove query params
            }
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        notif({
            icon: 'done',
            spinner: false,
            type: 'positive',
            message: 'Download completed!',
            caption: '',
            timeout: 2500
        });
    } catch (error) {
        console.error('Download failed:', error);
        notif({
            icon: 'warning',
            spinner: false,
            type: 'negative',
            message: 'Download failed',
            caption: 'Opening in new tab...',
            timeout: 2500
        });
        // Fallback to opening in new tab if fetch fails (e.g. CORS)
        window.open(props.src, '_blank');
    }
};

onUnmounted(() => {
    if (panzoomInstance && canvasElement.value) {
        const elem = canvasElement.value.querySelector('img');
        elem?.parentElement?.removeEventListener('wheel', panzoomInstance.zoomWithWheel);
        panzoomInstance.destroy();
    }
});
</script>

<style scoped>
.media-viewer-container {
    background-color: rgba(0, 0, 0, 0.9);
}

.panzoom-container {
    overflow: hidden;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.media-element {
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.z-max {
    z-index: 9999;
}
</style>
