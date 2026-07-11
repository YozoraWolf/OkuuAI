<template>
  <q-layout v-if="isStandaloneRoute" view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
  <div v-else-if="!isOkuuAIActive" class="container">
    <OkuuInactive />
  </div>
  <MainLayout v-else class="q-dark" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';
import { useAuthStore } from './stores/auth.store';
import { useConfigStore } from './stores/config.store';
import OkuuInactive from './pages/OkuuInactive.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const configStore = useConfigStore();
const isOkuuAIActive = ref(true);
const isStandaloneRoute = computed(() => route.matched.some((record) => record.meta.standalone));

onMounted(async () => {
  if (isStandaloneRoute.value) {
    return;
  }

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
