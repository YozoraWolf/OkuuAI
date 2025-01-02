import { defineStore } from 'pinia';
import { checkApiKey } from 'src/services/auth.service';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        apiKey: '',
    }),
    actions: {
        async checkApiKey(key: string) {
            const result = await checkApiKey(key);
            this.apiKey = result ? key : '';
            return result;
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