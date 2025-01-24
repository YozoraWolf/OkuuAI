<template>
    <div class="chat-message row no-wrap q-mb-sm full-width">
        <q-avatar :src="avatar" size="32px" round class="avatar flex flex-center">
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
                    <span class="user row">{{ user }}</span>
                    <span class="timestamp row">{{ formattedTimestamp }}</span>
                </div>
                <div class="flex self-end" v-if="deleteBtn">
                    <q-btn flat dense icon="mdi-trash-can" class="" color="red-5" @click="deleteMessage">
                    </q-btn>
                </div>
            </div>
            <span class="message-body q-mt-xs">{{ message }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useSessionStore } from 'src/stores/session.store';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(tz);

const sessionStore = useSessionStore();
const $q = useQuasar();

// props

const props = defineProps({
    timestamp: Number,
    user: String,
    avatar: String,
    message: String,
    memoryKey: String,
    deleteBtn: {
        type: Boolean,
        default: false,
    }
});

const formattedTimestamp = computed(() => {
    const userTimezone = localStorage.getItem('userTimezone') || dayjs.tz.guess();
    const timestamp = dayjs(Number(props.timestamp)).tz(userTimezone);

    // Get the offset in hours
    const offset = timestamp.utcOffset() / 60; // Convert minutes to hours
    const offsetSign = offset >= 0 ? '+' : '-'; // Determine the sign
    const formattedOffset = `${offsetSign}${Math.abs(offset)}`; // Format as "+9" or "-9"

    return timestamp.format(`YYYY-MM-DD HH:mm:ss (UTC${formattedOffset})`);
});

const deleteMessage = () => {
    $q.dialog({
        title: 'Delete Message',
        message: 'Are you sure you want to delete this message?',
        ok: 'Yes',
        cancel: 'No',
    }).onOk(async () => {
        if (!props.memoryKey) {
            return;
        }
        $q.loading.show();
        await sessionStore.deleteChatMessage(props.memoryKey);
        $q.loading.hide();
    });
}
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
    align-self: center;
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
</style>
