<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref } from 'vue';
import { useSendingStore, useChatHistoryStore, ChatMessage } from '../stores/chatStore';
import { socket } from '@/src/main'

const sendingStore = useSendingStore();
const chatHistoryStore = useChatHistoryStore();

const scrollToNewContent = () => {
    if (chatLog.value === null) return;
    chatLog.value.scrollTop = chatLog.value.scrollHeight;
};



// Load messages from server
let messages: Ref<ChatMessage[]> = ref([]);

onMounted(async () => {
    const chatHistory = await chatHistoryStore.loadChatHistory();
    messages.value = chatHistory; 
});


// Listen for events from the server
socket.on('chat', (data: ChatMessage) => { 
    console.log(`ID: ${data.id}`);
    if (messages.value[data.id] === undefined) {
        console.log(`Adding message: ${data.content}`);
        chatHistoryStore.addMessage(data);
    }

    if(data.type === 'ai' && !data.done) {
        sendingStore.setSending(true);
    }

    messages.value[data.id] = data;


    if(data.type === 'ai' && data.done) {
        sendingStore.setSending(false);
    }

    scrollToNewContent();
    
    //console.log('Messages:', messages);
});

const chatLog = ref<HTMLElement | null>(null);

let okuuThinking = ref('');

const okuuThinkInt = setInterval(() => {
    okuuThinking.value += '.';
    if (okuuThinking.value.length > 3) {
        okuuThinking.value = '';
    }
}, 500);

onUnmounted(() => {
    clearInterval(okuuThinkInt);
});

</script>

<template>
    <ul ref="chatLog" class="chat_log">
        <div v-if="messages === undefined || messages.length === 0" class="no-messages">No messages</div>
        <li class="chat_msg" v-for="msg in messages" :key="msg.id"> 
            <div class="name">{{ msg.type === 'ai' ? 'Okuu' : "User" }}</div>
            <div class="msg">{{ msg.content }}</div>
            <div class="thinking">{{ msg.type === 'ai' && !msg.done && msg.content.length === 0 ? okuuThinking : '' }}</div>
        </li>
    </ul>
</template>

<style>
.chat_log {
    display: flex;
    justify-content: left;
    flex-direction: column;

    margin: 10px;
    padding-right: 25px;

    margin-bottom: 0;

    overflow-y: scroll;

    --chat-size-scale: 1.5;

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

        .msg {
            white-space: pre-wrap;
            margin-left: 20px;
        }

        .thinking {
            font-style: italic;
            color: #fff;
            font-size: 2rem;
            min-height: 1rem;
        }
    }
}
</style>