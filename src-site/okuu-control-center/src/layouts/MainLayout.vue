<template>
  <q-layout view="lHh Lpr lFf">
    <q-drawer v-model="drawer" show-if-above bordered :mini="$q.screen.gt.sm" :mini-width="72" :width="250"
      class="drawer-transition">
      <div class="app-mark" v-if="!$q.screen.gt.sm">
        <span class="app-mark-dot"></span>
        <div><strong>Okuu</strong><span>Control center</span></div>
      </div>
      <q-list class="full-width nav-list">
        <template v-for="(link, index) in pageList" :key="index">
            <EssentialLink v-bind="link" class="full-width" />
        </template>
      </q-list>
    </q-drawer>

    <q-page-container class="q-pa-none">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in"><component :is="Component" /></transition>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import EssentialLink, { type EssentialLinkProps } from 'components/EssentialLink.vue';
const $q = useQuasar();

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

</script>

<style lang="scss" scoped>
.drawer-transition {
  color: var(--text-strong);
  background: linear-gradient(180deg, var(--surface-2), var(--surface-0));
  border-color: var(--surface-border) !important;
  transition: transform 260ms var(--ease-snappy);
}

.app-mark { display: flex; align-items: center; gap: 0.65rem; padding: 1.25rem 1.05rem 1rem; }
.app-mark-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--accent-1); box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-1) 13%, transparent); }
.app-mark strong, .app-mark span { display: block; }
.app-mark strong { font-size: 0.98rem; letter-spacing: -0.03em; }
.app-mark span { color: var(--text-muted); font-size: 0.68rem; }
.nav-list { padding-top: 0.65rem; }

.drawer-transition :deep(.q-item) {
  min-height: 46px;
  margin: 0.5rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--text-strong);
  transition: background 180ms var(--ease-snappy), border-color 180ms var(--ease-snappy);
}

.drawer-transition :deep(.q-item:hover) {
  border-color: var(--surface-border);
  background: rgba(255, 255, 255, 0.07);
}

.drawer-transition :deep(.q-item__label--caption) { color: var(--text-muted); }

.router-cont {
  transform-origin: top left;
  width: 100%;
  height: 100%;
}

.page-enter-active, .page-leave-active { transition: opacity 160ms var(--ease-snappy), transform 160ms var(--ease-snappy); }
.page-enter-from { opacity: 0; transform: translateY(5px); }
.page-leave-to { opacity: 0; transform: translateY(-3px); }
</style>
