import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import '../global.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

createApp(App).mount('#app')
