<template>
    <q-page class="change-password-page">
        <div class="change-password-container">
            <q-card class="change-password-card">
                <q-card-section class="header-section">
                    <div class="icon-wrapper">
                        <q-icon name="lock_reset" size="48px" color="warning" />
                    </div>
                    <div class="title">Change Password Required</div>
                    <div class="subtitle">For security reasons, you must change your password before continuing.</div>
                </q-card-section>

                <q-card-section>
                    <q-form @submit.prevent="submit" class="q-gutter-md form-col">
                        <q-input 
                            class="input-field" 
                            v-model="currentPassword" 
                            :type="showCurrentPassword ? 'text' : 'password'" 
                            label="Current Password" 
                            dense 
                            outlined 
                            autofocus 
                            :rules="[val => !!val || 'Current password is required']"
                        >
                            <template v-slot:append>
                                <q-icon 
                                    :name="showCurrentPassword ? 'visibility_off' : 'visibility'" 
                                    class="cursor-pointer" 
                                    @click="showCurrentPassword = !showCurrentPassword"
                                />
                            </template>
                        </q-input>
                        <q-input 
                            class="input-field" 
                            v-model="newPassword" 
                            :type="showNewPassword ? 'text' : 'password'" 
                            label="New Password" 
                            dense 
                            outlined 
                            :rules="[
                                val => !!val || 'New password is required',
                                val => val.length >= 6 || 'Password must be at least 6 characters'
                            ]"
                        >
                            <template v-slot:append>
                                <q-icon 
                                    :name="showNewPassword ? 'visibility_off' : 'visibility'" 
                                    class="cursor-pointer" 
                                    @click="showNewPassword = !showNewPassword"
                                />
                            </template>
                        </q-input>
                        <q-input 
                            class="input-field" 
                            v-model="confirmPassword" 
                            :type="showConfirmPassword ? 'text' : 'password'" 
                            label="Confirm New Password" 
                            dense 
                            outlined 
                            :rules="[
                                val => !!val || 'Please confirm your password',
                                val => val === newPassword || 'Passwords do not match'
                            ]"
                        >
                            <template v-slot:append>
                                <q-icon 
                                    :name="showConfirmPassword ? 'visibility_off' : 'visibility'" 
                                    class="cursor-pointer" 
                                    @click="showConfirmPassword = !showConfirmPassword"
                                />
                            </template>
                        </q-input>
                        <div class="row justify-center w-100">
                            <q-btn 
                                class="change-btn" 
                                label="Change Password" 
                                color="primary" 
                                :loading="isLoading" 
                                type="submit" 
                                unelevated 
                            />
                        </div>
                    </q-form>
                </q-card-section>

                <q-card-section class="help"> 
                    <small>Cannot logout until password is changed.</small>
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
import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

const $q = useQuasar();
const router = useRouter();
const authStore = useAuthStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

// Redirect if not authenticated or doesn't need password change
if (!authStore.isAuthenticated) {
    router.push('/login');
} else if (!authStore.mustChangePassword) {
    router.push('/');
}

const submit = async () => {
    if (newPassword.value !== confirmPassword.value) {
        $q.notify({ type: 'negative', message: 'Passwords do not match' });
        return;
    }

    if (newPassword.value.length < 6) {
        $q.notify({ type: 'negative', message: 'Password must be at least 6 characters' });
        return;
    }

    isLoading.value = true;
    try {
        const resolvedUrl = await resolveHostRedirect();
        const response = await axios.post(`${resolvedUrl}/users/change-password`, {
            currentPassword: currentPassword.value,
            newPassword: newPassword.value
        });

        if (response.status === 200) {
            $q.notify({ type: 'positive', message: 'Password changed successfully!' });
            
            // Update user object to remove mustChangePassword flag
            const updatedUser = { ...authStore.getUser, mustChangePassword: false };
            authStore.updateUser(updatedUser);
            
            // Redirect to home
            router.push('/');
        }
    } catch (error: any) {
        if (error.response?.status === 401) {
            $q.notify({ type: 'negative', message: 'Current password is incorrect' });
        } else {
            $q.notify({ type: 'negative', message: error.response?.data?.error || 'Failed to change password' });
        }
    } finally {
        isLoading.value = false;
    }
};
</script>

<style scoped>
.change-password-page {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%);
}
.change-password-container {
    width: 100%;
    max-width: 480px;
    padding: 24px;
}
.change-password-card {
    border-radius: 12px;
}
.header-section { 
    text-align: center; 
    padding-bottom: 8px;
}
.icon-wrapper {
    margin-bottom: 12px;
}
.title { 
    font-weight: 700; 
    font-size: 20px; 
    color: var(--q-color-white); 
    margin-bottom: 8px;
}
.subtitle { 
    color: rgba(255,255,255,0.75); 
    margin-bottom: 12px; 
    font-size: 14px;
    line-height: 1.4;
}
.help { 
    text-align: center; 
    color: rgba(255,255,255,0.6);
    padding-top: 8px;
}
.form-col { 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
}
.input-field { 
    width: 100%; 
    max-width: 400px; 
}
.change-btn { 
    width: 100%; 
    max-width: 400px; 
    padding: 12px 28px; 
    font-size: 16px; 
    white-space: nowrap; 
    text-align: center; 
    border-radius: 6px; 
}
</style>
