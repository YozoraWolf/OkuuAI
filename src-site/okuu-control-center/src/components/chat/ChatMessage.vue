<template>
    <div class="chat-message row no-wrap q-mb-sm full-width" @mouseover="showDeleteBtn = true"
        @mouseleave="showDeleteBtn = false">
        <q-avatar :src="avatar" size="32px" round class="avatar flex selft-start" style="z-index: 1;">
            <template v-if="!avatar">
                <div class="no-avatar flex flex-center" style="width: 32px; height: 32px;">
                    <q-icon name="person" />
                </div>
            </template>
            <q-img :src="avatar" />
        </q-avatar>
        <div class="full-width">
            <div class="flex full-width justify-between">
                <div class="flex column">
                    <span class="user row">{{ message.user }}</span>
                    <span class="timestamp row">{{ formattedTimestamp }}</span>
                </div>
                <MessageActions :visible="deleteBtn && showDeleteBtn" :can-delete="true" :can-edit="false"
                    @delete="deleteMessage" @edit="editMessage" />
            </div>
            <div class="flex column">
                <div class="message-body q-mt-xs">
                    <template v-for="(part, idx) in generateComponents(message.message, message.thinking)" :key="idx">
                        <component v-if="part.type === 'component'" :is="part.component" v-bind="part.props" />
                        <span v-else-if="part.type === 'html'" v-html="part.content" />
                        <span v-else-if="part.type === 'nl'" class="newline"><br></span>
                    </template>
                </div>
                <q-img v-if="message.attachment && isAttachmentImage"
                    :src="`data:image/png;base64,${message.attachment}`" loading="lazy"
                    class="attachment-image q-mt-sm q-ml-sm cursor-pointer non-selectable" @click="openPreview">
                    <template v-slot:loading>
                        <q-spinner size="50px" color="primary" />
                    </template>
                </q-img>
            </div>
            <div v-if="message.done && message.metadata?.web_search?.sources && message.metadata.web_search.sources.length > 0"
                class="q-mt-sm row q-gutter-xs">
                <q-chip v-for="(source, idx) in message.metadata.web_search.sources" :key="idx" clickable
                    @click="openSource(source.url)" color="teal-7" text-color="white" icon="link" size="sm"
                    class="cursor-pointer source-chip">
                    {{ source.title }}
                    <q-tooltip>{{ source.url }}</q-tooltip>
                </q-chip>
            </div>

            <!-- Web Search Images -->
            <div v-if="message.done && message.metadata?.image_urls && message.metadata.image_urls.length > 0"
                class="q-mt-sm row q-gutter-sm">
                <div v-for="(url, idx) in message.metadata.image_urls" :key="idx" class="relative-position col-auto">
                    <q-img :src="url" loading="lazy" class="rounded-borders cursor-pointer shadow-2"
                        style="height: 150px; width: 150px; object-fit: cover;" @click="openSource(url)">
                        <template v-slot:loading>
                            <q-spinner size="30px" color="primary" />
                        </template>
                        <template v-slot:error>
                            <div class="absolute-full flex flex-center bg-grey-3 text-grey-6">
                                <q-icon name="broken_image" size="24px" />
                            </div>
                        </template>
                    </q-img>
                </div>
            </div>

            <!-- Danbooru Images -->
            <div v-if="message.done && message.metadata?.danbooru_images && message.metadata.danbooru_images.length > 0"
                class="q-mt-sm">
                <div v-for="(image, idx) in message.metadata.danbooru_images" :key="idx"
                    class="danbooru-image-container q-mb-md">
                    <q-img :src="image.url" loading="lazy" class="danbooru-image cursor-pointer"
                        @click="openSource(image.source)">
                        <template v-slot:loading>
                            <q-spinner size="50px" color="primary" />
                        </template>
                    </q-img>
                    <div class="q-mt-xs row q-gutter-xs">
                        <q-chip v-if="image.artist" size="sm" color="purple-7" text-color="white" icon="brush">
                            {{ image.artist }}
                        </q-chip>
                        <q-chip size="sm"
                            :color="image.rating === 's' ? 'green-7' : image.rating === 'q' ? 'orange-7' : 'red-7'"
                            text-color="white" :icon="image.rating === 's' ? 'check_circle' : 'warning'">
                            {{ image.rating === 's' ? 'Safe' : image.rating === 'q' ? 'Questionable' : 'Explicit' }}
                        </q-chip>
                    </div>
                </div>
            </div>

        </div>
        <!-- TODO: Work on this -->
        <PreviewImage :imageSrc="`data:image/png;base64,${message.attachment}` || ''" :visible="previewVisible"
            @close="closePreview" />
    </div>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, onMounted, watch, ComputedRef } from 'vue';
import { useQuasar } from 'quasar';
import { useSessionStore, Message } from 'src/stores/session.store';
import { useConfigStore } from 'src/stores/config.store';
import PreviewImage from 'src/components/chat/PreviewImage.vue';
import MessageActions from 'src/components/chat/MessageActions.vue';
import { generateComponents } from 'src/utils/txt_format_utils';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(tz);

const sessionStore = useSessionStore();
const configStore = useConfigStore();

const $q = useQuasar();

// props

const props = defineProps({
    message: {
        type: Object as () => Message,
        required: true,
    },
    deleteBtn: {
        type: Boolean,
        default: false,
    }
});

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];

const showDeleteBtn = ref(false);


const okuu_pfp = ref();

const avatar: ComputedRef<any> = computed(() => props.message.user.toLocaleLowerCase() === 'okuu' ? okuu_pfp : '');

const formattedTimestamp = computed(() => {
    const userTimezone = localStorage.getItem('userTimezone') || dayjs.tz.guess();
    const ts = dayjs(Number(props.message.timestamp)).tz(userTimezone);
    const offset = ts.utcOffset() / 60;
    const offsetSign = offset >= 0 ? '+' : '-';
    const formattedOffset = `${offsetSign}${Math.abs(offset)}`;
    return ts.format(`YYYY-MM-DD HH:mm:ss (UTC${formattedOffset})`);
});

const previewVisible = ref(false);

const isAttachmentImage = computed(() => {
    const ext = props.message.file?.split('.').pop()?.toLowerCase();
    return imageExts.includes(ext || '');
});

const deleteMessage = () => {
    $q.dialog({
        title: 'Delete Message',
        message: 'Are you sure you want to delete this message?',
        ok: 'Yes',
        cancel: 'No',
    }).onOk(async () => {
        const memoryKey = await sessionStore.getMemoryKey(props.message.sessionId, props.message.timestamp);
        console.log('Deleting message', memoryKey);
        if (!memoryKey) {
            return;
        }
        $q.loading.show();
        await sessionStore.deleteChatMessage(memoryKey, props.message.sessionId);
        $q.loading.hide();
    });
}

const editMessage = () => {
    console.log('Edit message clicked');
    // TODO: Implement edit message logic
}

const openPreview = () => {
    console.log('Opening image', previewVisible.value);
    previewVisible.value = true;
}

const closePreview = () => {
    previewVisible.value = false;
}

const openSource = (url: string) => {
    window.open(url, '_blank');
}

onMounted(async () => {
    okuu_pfp.value = configStore.okuuPfp;

    // Debug: Log message data to check done flag and metadata
    if (props.message.metadata?.web_search?.sources) {
        console.log('Message with sources:', {
            user: props.message.user,
            done: props.message.done,
            sourcesCount: props.message.metadata.web_search.sources.length,
            sources: props.message.metadata.web_search.sources
        });
    }
});

</script>

<style lang="scss" scoped>
.chat-message {
    display: flex;
    align-items: center;
    flex-direction: row;
    margin-top: 2%;
    margin-bottom: 2%;
}

.avatar {
    align-self: flex-start;
    margin-right: 1%;
}

.user {
    font-weight: bold;
}

.timestamp {
    color: gray;
    font-size: 0.8em;
}

.message-body {
    margin-top: 5px;
    white-space: pre-wrap;
    word-break: break-word;
}

.attachment-image {
    max-width: 20%;
    max-height: 200px;
}

.source-chip {
    transition: all 0.2s ease;
}

.source-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.danbooru-image-container {
    max-width: 500px;
}

.danbooru-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    transition: transform 0.2s ease;
}

.danbooru-image:hover {
    transform: scale(1.02);
}
</style>
