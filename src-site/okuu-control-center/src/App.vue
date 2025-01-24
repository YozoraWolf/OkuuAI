<template>
  <MainLayout />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import MainLayout from './layouts/MainLayout.vue';
import { useAuthStore } from './stores/auth.store';

const authStore = useAuthStore();

onMounted(() => {
  console.log('Hello, OkuuAI Control Center!');
  authStore.loadApiKey();
});
//
</script>
