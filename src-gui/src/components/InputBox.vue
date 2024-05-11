<script setup lang="ts">
import { socket } from '@/src/main'
import { ref } from 'vue';
import { useSendingStore, useChatHistoryStore, ChatMessage } from '../stores/chatStore';

const sendingStore = useSendingStore();
const chatHistoryStore = useChatHistoryStore();

// TODO: Work on special key combos Shift, Ctrl, Alt.
const userMsg = ref('');
const sendMsg = (event: any) => {
    if(event.key !== 'Enter') return;
    if (event.shiftKey || event.ctrlKey || event.altKey) {
        return;
    }
    if (userMsg.value === '') return;
    //console.log(`Store sending: ${sendingStore.sending}`);
    if (sendingStore.sending) return;
    //console.log(`Sending message: ${userMsg.value}`);
    sendingStore.setSending(true);
    //console.log(`Store sending: ${sendingStore.sending} (A)`);


    const msg: ChatMessage = {
        id: chatHistoryStore.getChatHistory().length,
        type: 'user',
        content: userMsg.value,
        done: true,
    };

    socket.emit('chat', msg);
    userMsg.value = '';
}

const inputBox = ref<HTMLElement | null>(null);
const resizeInput = () => {
    if (inputBox.value === null) return;
    inputBox.value.style.height = 'auto';
    inputBox.value.style.height = (inputBox.value.scrollHeight-30) + 'px';
};

</script>

<template>
    <div class="input-cont">
        <textarea :disabled="sendingStore.sending" ref="inputBox" class="input" v-model="userMsg" 
        @keydown="sendMsg($event)" @input="resizeInput()"></textarea>
        <button :disabled="sendingStore.sending" class="send-btn">></button>
        <!-- <p>Sending state: {{ sendingStore.sending }}</p> -->
    </div>
</template>

<style>
.input-cont {

    --chat-size-scale: 1.5;

    display: flex;
    flex-direction: row;
    align-items: center;

    background-color: var(--color-primary-darker);

    padding: 10px;


    .input {

        width: 95%;
        height: 30px;

        max-height: 200px;
        border: 1px solid black;
        border-radius: 5px;
        margin: 5px;

        font-size: calc(1em * var(--chat-size-scale));

        color: white;
        background-color: var(--color-primary);
    }

    .input:disabled {
        background-color: #0e0e0e;
    }

    .send-btn {
        width: 5%;
        height: 30px;
        border: 1px solid black;
        border-radius: 100px;
        padding: 5px;
        margin: 5px;

        color: white;
        background-color: #007700;
    }
}
</style>