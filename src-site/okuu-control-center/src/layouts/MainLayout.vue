<template>
  <q-layout view="lHh Lpr lFf">
    <q-drawer v-model="drawer" show-if-above bordered :mini="toggleMini" @mouseenter="toggleMini = false"
      @mouseleave="toggleMini = true" class="drawer-transition full-width">
      <q-list class="full-width">
        <template v-for="(link, index) in pageList" :key="index">
            <EssentialLink v-bind="link" class="full-width" />
        </template>
      </q-list>
    </q-drawer>

    <q-page-container class="q-pa-none">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EssentialLink, { type EssentialLinkProps } from 'components/EssentialLink.vue';

const pageList: EssentialLinkProps[] = [
  {
    title: 'Status',
    caption: 'Check OkuuAI status',
    icon: 'monitor_heart',
    path: '/'
  },
  {
    title: 'Login',
    caption: 'Login to OkuuAI Control Center',
    icon: 'login',
    path: '/login'
  },
  {
    title: 'Settings',
    caption: 'Configure OkuuAI',
    icon: 'settings',
    path: '/settings',
    auth: true,
  },
  {
    title: 'Chat',
    caption: 'Chat with OkuuAI',
    icon: 'chat',
    path: '/chat',
    auth: true,
  },
  {
    title: 'Logout',
    caption: 'Bye!',
    icon: 'logout',
    auth: true,
  }
];

const drawer = ref(true);
const toggleMini = ref(true);

</script>

<style lang="scss" scoped>
.drawer-transition {
  transition: width 0.3s;
}
</style>