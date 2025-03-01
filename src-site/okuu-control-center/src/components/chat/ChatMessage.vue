<template>
    <div class="chat-message row no-wrap q-mb-sm full-width" @mouseover="showDeleteBtn = true" @mouseleave="showDeleteBtn = false">
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
                    <span class="user row">{{ localMessage.user }}</span>
                    <span class="timestamp row">{{ formattedTimestamp }}</span>
                </div>
                <div class="flex self-end" v-if="deleteBtn && showDeleteBtn">
                    <q-btn flat dense icon="mdi-trash-can" class="" color="red-5" @click="deleteMessage">
                    </q-btn>
                </div>
            </div>
            <div class="flex column">
                <span class="message-body q-mt-xs">{{ localMessage.message }}</span>
                <q-img v-if="localMessage.attachment && isAttachmentImage" 
                :src="`data:image/png;base64,${localMessage.attachment}`"
                loading="lazy"
                class="attachment-image q-mt-sm q-ml-sm cursor-pointer non-selectable"
                @click="openPreview"
                >
                <template v-slot:loading>
                    <q-spinner size="50px" color="primary" />
                </template>    
            </q-img>
            </div>
            
        </div>
        <!-- TODO: Work on this -->
        <PreviewImage :imageSrc="`data:image/png;base64,${localMessage.attachment}` || ''" :visible="previewVisible" @close="closePreview" />
    </div>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, onMounted, watch, ComputedRef } from 'vue';
import { useQuasar } from 'quasar';
import { useSessionStore, Message } from 'src/stores/session.store';
import { useConfigStore } from 'src/stores/config.store';
import PreviewImage from 'src/components/chat/PreviewImage.vue';
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

const localMessage = ref({ ...props.message });

const okuu_pfp = ref();

const avatar: ComputedRef<any>   = computed(() => localMessage.value.user.toLocaleLowerCase() === 'okuu' ? okuu_pfp : '');

const formattedTimestamp = computed(() => {
    const userTimezone = localStorage.getItem('userTimezone') || dayjs.tz.guess();
    const ts = dayjs(Number(localMessage.value.timestamp)).tz(userTimezone);

    // Get the offset in hours
    const offset = ts.utcOffset() / 60; // Convert minutes to hours
    const offsetSign = offset >= 0 ? '+' : '-'; // Determine the sign
    const formattedOffset = `${offsetSign}${Math.abs(offset)}`; // Format as "+9" or "-9"

    return ts.format(`YYYY-MM-DD HH:mm:ss (UTC${formattedOffset})`);
});

const previewVisible = ref(false);

const isAttachmentImage = computed(() => {
    const ext = localMessage.value.file?.split('.').pop()?.toLowerCase();
    return imageExts.includes(ext || '');
});

const deleteMessage = () => {
    $q.dialog({
        title: 'Delete Message',
        message: 'Are you sure you want to delete this message?',
        ok: 'Yes',
        cancel: 'No',
    }).onOk(async () => {
        const memoryKey = await sessionStore.getMemoryKey(localMessage.value.sessionId, localMessage.value.timestamp);
        console.log('Deleting message', memoryKey);
        if (!memoryKey) {
            return;
        }
        $q.loading.show();
        await sessionStore.deleteChatMessage(memoryKey, localMessage.value.sessionId);
        $q.loading.hide();
    });
}

const openPreview = () => {
    console.log('Opening image', previewVisible.value);
    previewVisible.value = true;
}

const closePreview = () => {
    previewVisible.value = false;
}

onMounted(async () => {
    okuu_pfp.value = configStore.okuuPfp;
});

watch(
    () => props.message,
    (newMessage) => {
        localMessage.value = { ...newMessage };
    },
    { deep: true }
);

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
}

.attachment-image {
    max-width: 20%;
    max-height: 200px;
}
</style>
