<template>
    <div class="chat-message row no-wrap q-mb-sm">
        <q-avatar :src="avatar" size="32px" round class="avatar flex flex-center">
            <template v-if="!avatar">
                <div class="no-avatar flex flex-center" style="width: 32px; height: 32px;">
                    <q-icon name="person" />
                </div>              
            </template>
            <q-img :src="avatar" />
        </q-avatar>
        <div class="message-content q-ml-sm">
            <div class="message-header">
                <span class="user">{{ user }}</span>
                <span class="timestamp">{{ formattedTimestamp }}</span>
            </div>
            <span class="message-body q-mt-xs">{{ message }}</span>
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
    timestamp: Number,
    user: String,
    avatar: String,
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
    align-items: center;
    flex-direction: row;
    margin-top: 2%;
    margin-bottom: 2%;

}

.avatar {
    align-self: center;
    margin-right: 1%;
}


.message-content {
    margin-left: 10px;
    margin-right: 10px;
    width: 95%;
    flex: 1 1 auto; /* Add this line to allow the content to shrink */
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
