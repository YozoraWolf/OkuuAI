<template>
  <div v-if="!isOkuuAIActive" class="container">
    <OkuuInactive />
  </div>
  <MainLayout v-else class="q-dark" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';
import { useAuthStore } from './stores/auth.store';
import { useConfigStore } from './stores/config.store';
import OkuuInactive from './pages/OkuuInactive.vue';

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();
const isOkuuAIActive = ref(true);

onMounted(async () => {

  // Check if OkuuAI is active
  isOkuuAIActive.value = await configStore.checkOkuuAIStatus();

  // If not authenticated (no token), redirect to login page
  if (!authStore.isAuthenticated) {
    router.push('/login');
    return;
  }

  console.log('%c☢️ Hello, OkuuAI Control Center!', 'font-size: 20px;');
});
</script>
