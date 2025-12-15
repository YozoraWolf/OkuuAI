<template>
    <q-page class="login-page">
        <div class="login-container">
            <q-card class="login-card">
                <q-card-section class="logo-section">
                    <img src="/icons/radioa.svg" alt="logo" class="logo" />
                    <div class="title">Okuu Control Center</div>
                    <div class="subtitle">Sign in to continue</div>
                </q-card-section>

                <q-card-section>
                    <q-form @submit.prevent="submit" class="q-gutter-md form-col">
                        <q-input class="input-field" v-model="username" label="Username" dense outlined autofocus />
                        <q-input class="input-field" v-model="password" type="password" label="Password" dense outlined />
                        <div class="remember-row">
                            <q-toggle v-model="remember" label="Remember me" dense />
                            <q-btn flat label="Forgot?" size="sm" @click="$q.notify({ type: 'info', message: 'Use admin/admin initially' })" />
                        </div>
                        <div class="row justify-center w-100">
                            <q-btn class="signin-btn" label="Sign in" color="primary" :loading="isRateLimited" type="submit" unelevated />
                        </div>
                    </q-form>
                </q-card-section>

                <q-card-section class="help"> 
                    <small>Powered by OkuuAI · Contact admin to manage accounts.</small>
                </q-card-section>
            </q-card>
        </div>
    </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from 'src/stores/auth.store';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';

const $q = useQuasar();

const router = useRouter();

const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const remember = ref(true);

const isRateLimited = ref(false);

const submit = async () => {
    isRateLimited.value = true;
    const ok = await authStore.login(username.value, password.value);
    isRateLimited.value = false;
    if (ok) {
        // optionally persist token longer when remembered
        if (remember.value) {
            // already stored in localStorage by the store
        }
        router.push('/');
    } else {
        $q.notify({ type: 'negative', message: 'Invalid username or password' });
    }
}
</script>

<style scoped>
.login-page {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%);
}
.login-container {
    width: 100%;
    max-width: 420px;
    padding: 24px;
}
.login-card {
    border-radius: 12px;
}
.logo-section { text-align: center; }
.logo { width: 64px; height: 64px; margin-bottom: 8px; }
.title { font-weight: 700; font-size: 18px; color: var(--q-color-white); }
.subtitle { color: rgba(255,255,255,0.75); margin-bottom: 12px; }
.help { text-align:center; color:rgba(255,255,255,0.6) }
.form-col { display:flex; flex-direction:column; align-items:center; }
.input-field { width: 100%; max-width: 360px; }
.remember-row { width: 100%; max-width: 360px; display:flex; justify-content:space-between; align-items:center; margin-top: 6px; }
.signin-btn { width: 100%; max-width: 360px; padding: 12px 28px; font-size: 16px; white-space: nowrap; text-align: center; border-radius: 6px; }
</style>