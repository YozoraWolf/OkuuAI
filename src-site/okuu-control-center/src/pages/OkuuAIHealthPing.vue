<template>
    <div class="heartbeat-container">
        <div :class="`icon-cont flex column full-width`">
            <q-icon  name="mdi-radioactive"
            :class="`${isOnline ? 'online' : 'offline'} ${isOnline ? 'spin' : ''} `">
            </q-icon>
            <h2>OkuuAI is {{ isOnline ? 'Running!' : 'Down...' }}</h2>
        </div>
        
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

const lastCheck = ref(Date.now());
const firstBeat = ref(false);
const isOnline = ref(false);



onMounted(async () => {
    const resolvedUrl = await resolveHostRedirect();
    console.log('Resolved WebSocket URL:', resolvedUrl);
    let connection: Socket;
    try {
        connection = io(`wss://${resolvedUrl}`, {
            transports: ['websocket'],
        });
    } catch (error) {
        //console.error('Failed to connect to server:', error);
        return;
    }

    connection.on('connect', () => {
        console.log('Connected to server');
        connection.emit('pong');
    });


    connection.on('ping', (event) => {
        lastCheck.value = Date.now();
        firstBeat.value = true;
        isOnline.value = true;
    });

    // Check server status. If server has not sent a ping in the last 15 seconds, consider it offline
    setInterval(() => {
        if (!firstBeat.value) return;
        if (Date.now() - lastCheck.value > 15000) {
            isOnline.value = false;
        } else {
            isOnline.value = true;
        }
    }, 5000);



});
</script>

<style lang="scss" scoped>
.heartbeat-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;    
    transform-origin: center;
}

.icon-cont {
    width: 200px;
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.q-icon {
    font-size: 200px;

    &.online {
        color: rgb(255, 145, 0);
    }

    &.offline {
        color: rgb(133, 0, 0);
    }
}

.spin {
    animation: spin 2s linear infinite;
    display: inline-block;
    position: relative;
    transform-origin: 50% 50%;

}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

</style>