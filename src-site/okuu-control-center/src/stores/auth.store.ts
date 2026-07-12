import { defineStore } from 'pinia';
import { loginWithCredentials, setAuthToken } from 'src/services/auth.service';

const isTokenValid = (token: string) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
        return !payload.exp || payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
};

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
                return { success: true, mustChangePassword: this.user?.mustChangePassword };
            }
            return { success: false, mustChangePassword: false };
        },
        logout() {
            this.token = '';
            this.user = null;
            setAuthToken(null);
            localStorage.removeItem('user');
        },
        updateUser(user: any) {
            this.user = user;
            localStorage.setItem('user', JSON.stringify(this.user));
        }
    },
    getters: {
        isAuthenticated: (state) => isTokenValid(state.token),
        getUser: (state) => state.user,
        mustChangePassword: (state) => state.user?.mustChangePassword === true,
    },
});
