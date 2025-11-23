<template>
    <div class="inline-media-container q-my-sm">
        <q-img v-if="isImage" :src="url" loading="lazy" class="inline-image cursor-pointer" @click="openInNewTab">
            <template v-slot:loading>
                <q-spinner size="40px" color="primary" />
            </template>
            <template v-slot:error>
                <div class="absolute-full flex flex-center bg-grey-3">
                    <q-icon name="broken_image" size="32px" color="grey-6" />
                </div>
            </template>
        </q-img>
        <video v-else-if="isVideo" :src="url" autoplay loop muted playsinline class="inline-video cursor-pointer"
            @click="openInNewTab">
            Your browser does not support the video tag.
        </video>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    url: string;
}>();

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];

const isImage = computed(() => {
    const lowerUrl = props.url.toLowerCase();
    return IMAGE_EXTENSIONS.some(ext => lowerUrl.includes(ext));
});

const isVideo = computed(() => {
    const lowerUrl = props.url.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => lowerUrl.includes(ext));
});

const openInNewTab = () => {
    window.open(props.url, '_blank');
};
</script>

<style scoped lang="scss">
.inline-media-container {
    max-width: 400px;
    border-radius: 8px;
    overflow: hidden;
}

.inline-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    transition: transform 0.2s ease;

    &:hover {
        transform: scale(1.02);
    }
}

.inline-video {
    max-width: 100%;
    height: auto;
    border-radius: 8px;

    &:hover {
        opacity: 0.9;
    }
}
</style>
