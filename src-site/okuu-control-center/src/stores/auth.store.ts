import { defineStore } from 'pinia';
import { loginWithCredentials, setAuthToken } from 'src/services/auth.service';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token') || '',
        user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') as string) : null,
    }),
    actions: {
        async login(username: string, password: string) {
            const res = await loginWithCredentials(username, password);
            if (res && res.status === 200 && res.data?.token) {
                this.token = res.data.token;
                this.user = res.data.user;
                localStorage.setItem('user', JSON.stringify(this.user));
                setAuthToken(this.token);
                return true;
            }
            return false;
        },
        logout() {
            this.token = '';
            this.user = null;
            setAuthToken(null);
            localStorage.removeItem('user');
        }
    },
    getters: {
        isAuthenticated: (state) => !!state.token,
        getUser: (state) => state.user,
    },
});