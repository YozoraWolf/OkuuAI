<template>
    <q-page class="flex flex-center">
        <q-card>
            <q-card-section>
                <div class="text-h6">Enter API Key</div>
            </q-card-section>
            <q-card-section>
                <q-input
                    v-model="apiKey"
                    type="password"
                    label="API Key"
                    @keyup.enter="submitApiKey"
                    outlined
                    dense
                />
            </q-card-section>
            <q-card-actions align="right">
                <q-btn label="Login" color="primary" @click="submitApiKey" />
            </q-card-actions>
        </q-card>
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

const apiKey = ref('');

const submitApiKey = async () => {
    // Handle API key submission
    const result = await authStore.checkApiKey(apiKey.value);
    if (result) {
        // Redirect to status page
        router.push('/');
    } else {
        // Notify error
        $q.notify({
            type: 'negative',
            message: 'Invalid API Key',
        });
    }
}
</script>

<style scoped>
.q-page {
    height: 100vh;
}
</style>