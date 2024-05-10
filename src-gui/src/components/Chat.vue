<script setup lang="ts">
import { io } from 'socket.io-client';
import { ref } from 'vue';
import { useSendingStore } from '../stores/chatStore';

const sendingStore = useSendingStore();

interface ChatMessage {
    id: number;
    type: string;
    content: string;
    done: boolean;
}


const socket = io('ws://localhost:3009', {
    transports: ['websocket'],
});
const messages = ref<ChatMessage[]>([]);


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

</script>

<template>
    <ul class="chat_log">
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