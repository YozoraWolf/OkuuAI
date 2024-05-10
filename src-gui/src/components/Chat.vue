<script setup lang="ts">
import { io } from 'socket.io-client';
import { ref, watch } from 'vue';
import { useSendingStore } from '../stores/chatStore';
import env from '../../env.json';
import axios from 'axios';

const sendingStore = useSendingStore();

interface ChatMessage {
    id: number;
    type: string;
    content: string;
    done: boolean;
}

const scrollToNewContent = () => {
    if(chatLog.value === null) return;
        chatLog.value.scrollTop = chatLog.value.scrollHeight;
};

const socket = io(`ws://localhost:${env.okuuai_port}`, {
    transports: ['websocket'],
});
const messages = ref<ChatMessage[]>([]);

// Load messages from server

(async () => {
    try {
        const response = await axios.get(`http://localhost:${env.okuuai_port}/memory`, {
            params: {
                msg_limit: 20
            }
        });
        messages.value = response.data;
        scrollToNewContent();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
})();

// Listen for events from the server
socket.on('chat', (data: ChatMessage) => {
    console.log('!');
    if (messages.value[data.id] === undefined) {
        messages.value.push({
            ...data,
            id: data.id,
            content: ''
        });
    }

    const content: string = messages.value[data.id].content + (data.content || '');

    messages.value[data.id] = {
        ...messages.value[data.id],
        content: content,
        done: data.done,
    };


    if(data.type === 'ai' && data.done) {
        sendingStore.setSending(false);
    }
    
    console.log('Messages:', messages);
});

const chatLog = ref<HTMLElement | null>(null);



// Call the scroll function whenever new content is added
watch(messages, () => {
    scrollToNewContent();
});

</script>

<template>
    <ul ref="chat_log" class="chat_log">
        <div v-if="messages.length === 0" class="no-messages">No messages</div>
        <li class="chat_msg" v-for="msg in messages" :key="msg.id">
            <div class="name">{{ msg.type === 'ai' ? 'Okuu' : "User" }}</div>
            <div class="msg">{{ msg.content }}</div>
        </li>
    </ul>
</template>

<style>
.chat_log {
    display: flex;

    --chat-size-scale: 1.5;

    justify-content: left;

    flex-direction: column;

    overflow-y: scroll;

    .chat_msg {

        font-size: calc(1em * var(--chat-size-scale));

        display: flex;
        justify-content: left;
        flex-direction: column;

        color: white;
        list-style: none;
        text-align: left;

        .name {
            font-weight: bold;
            margin-top: 5px;
            margin-bottom: 5px;
        }
    }
}
</style>