import { defineStore } from 'pinia';
import { checkApiKey } from 'src/services/auth.service';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        apiKey: '',
    }),
    actions: {
        async checkApiKey(key: string) {
            const result = await checkApiKey(key);
            const isKeyValid = result && result.status === 200;
            this.apiKey = isKeyValid ? key : '';
            if(isKeyValid) {
                localStorage.setItem('apiKey', this.apiKey);
            }
            return result;
        },
        loadApiKey() {
            this.apiKey = localStorage.getItem('apiKey') || '';
        },
        logout() {
            this.apiKey = '';
        }
    },
    getters: {
        isAuthenticated: (state) => !!state.apiKey,
        getApiKey: (state) => state.apiKey,
    },
});