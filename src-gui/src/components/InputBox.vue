<script setup lang="ts">
import { io } from 'socket.io-client';
import { ref } from 'vue';
import { useSendingStore } from '../stores/chatStore';

const sendingStore = useSendingStore();

const socket = io('ws://localhost:3009', {
    transports: ['websocket'],
});

// TODO: Work on special key combos Shift, Ctrl, Alt.
const userMsg = ref('');
const sendMsg = (event: any) => {
    if(event.key !== 'Enter') return;
    if (event.shiftKey || event.ctrlKey || event.altKey) {
        return;
    }
    if (userMsg.value === '') return;
    console.log(`Store sending: ${sendingStore.sending}`);
    if (sendingStore.sending) return;
    console.log(`Sending message: ${userMsg.value}`);
    sendingStore.setSending(true)
    console.log(`Store sending: ${sendingStore.sending} (A)`);

    socket.emit('chat', {
        type: 'user',
        content: userMsg.value,
    });
    userMsg.value = '';
}

</script>

<template>
    <div class="input-cont">
        <textarea :disabled="sendingStore.sending" class="input" v-model="userMsg" @keydown="sendMsg($event)"></textarea>
        <button :disabled="sendingStore.sending" class="send-btn" @click="sendMsg($event)">></button>
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
        border: 1px solid black;
        border-radius: 5px;
        padding: 5px;
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