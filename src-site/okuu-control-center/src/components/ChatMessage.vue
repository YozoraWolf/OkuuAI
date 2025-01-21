<template>
    <div class="chat-message row items-start q-mb-sm">
        <q-avatar :src="avatar" size="32px" rounded>
            <template v-if="!avatar">
                <q-icon name="person" />
            </template>
        </q-avatar>
        <div class="message-content q-ml-sm">
            <div class="message-header">
                <span class="user">{{ username }}</span>
                <span class="timestamp">{{ formattedTimestamp }}</span>
            </div>
            <div class="message-body q-mt-xs">{{ message }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(tz);

const props = defineProps({
    timestamp: String,
    username: String,
    avatar: {
        type: String,
        default: ''
    },
    message: String,
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
</script>

<style lang="scss" scoped>
.chat-message {
    display: flex;
    align-items: flex-start;
    flex-direction: row;
    margin-bottom: 10px;
}

.message-content {
    margin-left: 10px;
    margin-right: 10px;
    width: 95%;
}

.message-header {
    display: flex;
    flex-direction: column;
    font-size: 0.9em;
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
