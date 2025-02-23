<template>
  <MainLayout class="q-dark" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import MainLayout from './layouts/MainLayout.vue';
import { useAuthStore } from './stores/auth.store';

const authStore = useAuthStore();

onMounted(() => {
  console.log('%c☢️ Hello, OkuuAI Control Center!', 'font-size: 20px;');
  authStore.loadApiKey();
});
</script>
