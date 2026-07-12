<template>
    <div class="heartbeat-container">
        <div class="icon-cont">
            <div class="logo-spinner" :class="{ spin: isOnline }">
                <svg class="status-logo" :class="isOnline ? 'online' : 'offline'" viewBox="0 0 200 200" aria-hidden="true">
                    <path d="M100 70 68 15a98 98 0 0 1 64 0Z" />
                    <path d="M100 70 68 15a98 98 0 0 1 64 0Z" transform="rotate(120 100 100)" />
                    <path d="M100 70 68 15a98 98 0 0 1 64 0Z" transform="rotate(240 100 100)" />
                    <circle cx="100" cy="100" r="21" />
                </svg>
            </div>
            <h2>OkuuAI is {{ isOnline ? 'Running!' : 'Down...' }}</h2>
        </div>
        
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

const lastCheck = ref(Date.now());
const firstBeat = ref(false);
const isOnline = ref(false);



onMounted(async () => {
    const resolvedUrl = await resolveHostRedirect();
    console.log('Resolved WebSocket URL:', resolvedUrl);
    let connection: Socket;
    try {
        const url = new URL(resolvedUrl);
        const protocol = process.env.LOCAL ? 'ws' : window.location.protocol === 'https:' ? 'wss' : 'ws';
        connection = io(`${protocol}://${url.host}`, {
            transports: ['websocket'],
            timeout: 5000,
        });
        connection.connect();
    } catch (error) {
        //console.error('Failed to connect to server:', error);
        return;
    }

    connection.on('connect', () => {
        console.log('Connected to server');
        isOnline.value = true;
    });


    connection.on('ping', (event) => {
        lastCheck.value = Date.now();
        firstBeat.value = true;
        isOnline.value = true;
    });


});
</script>

<style lang="scss" scoped>
.heartbeat-container {
    display: grid;
    min-height: 100dvh;
    width: 100%;
    place-items: center;
    transform-origin: center;
    background: radial-gradient(circle at center, color-mix(in srgb, var(--accent-1) 18%, transparent), transparent 48%), var(--surface-0);
}

.icon-cont {
    position: relative;
    display: grid;
    width: 200px;
    height: 200px;
    place-items: center;
    text-align: center;
}

.logo-spinner {
    display: grid;
    width: 200px;
    height: 200px;
    place-items: center;
    transform-origin: center;
    will-change: transform;
}

.icon-cont h2 { position: absolute; top: calc(100% + 1rem); width: max-content; margin: 0; white-space: nowrap; }

.status-logo { width: 200px; height: 200px; fill: var(--accent-1); }
.status-logo.offline { fill: color-mix(in srgb, var(--accent-1) 35%, #5e2020); }

.spin {
    animation: spin 2s linear infinite;
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
