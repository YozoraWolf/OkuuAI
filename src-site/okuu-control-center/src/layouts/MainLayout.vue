<template>
  <q-layout view="lHh Lpr lFf">
    <q-drawer v-model="drawer" show-if-above bordered :mini="toggleMini" mini-to-overlay @mouseenter="toggleMini = false"
      @mouseleave="toggleMini = true" :width="250" class="drawer-transition full-width">
      <q-list class="full-width">
        <template v-for="(link, index) in pageList" :key="index">
            <EssentialLink v-bind="link" class="full-width" />
        </template>
      </q-list>
    </q-drawer>

    <transition name="backdrop-fade">
      <div v-if="!toggleMini" class="drawer-backdrop" @click="toggleMini = true"></div>
    </transition>

    <q-page-container  ref="routerCont" class="q-pa-none">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import EssentialLink, { type EssentialLinkProps } from 'components/EssentialLink.vue';
import { useConfigStore } from 'src/stores/config.store';

const configStore = useConfigStore();

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
    path: '/logout',
    auth: true,
  }
];

const drawer = ref(true);
const toggleMini = ref(true);

const routerCont = ref<HTMLElement>();

// computed

const zoomLevel = computed(() => configStore.getZoomLevel() * 0.01);

onMounted(async () => {
  console.log('MainLayout mounted');
});

</script>

<style lang="scss" scoped>
.drawer-transition {
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.router-cont {
  transform-origin: top left;
  width: 100%;
  height: 100%;
}

.drawer-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  pointer-events: all;
}

.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}
</style>