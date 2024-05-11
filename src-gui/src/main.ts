import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import '../global.css'
import { io } from 'socket.io-client'
import env from '@/env.json'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

export const socket = io(`ws://localhost:${env.okuuai_port}`, {
    transports: ['websocket'],
});

createApp(App).mount('#app')
