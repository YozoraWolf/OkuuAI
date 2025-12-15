<template>
  <q-item
    clickable
    tag="a"
    @click="doPageRedirect(props.path)"
    v-if="(!props.auth || authStore.isAuthenticated) && (props.path !== '/login' || !authStore.isAuthenticated)"
  >
    <q-item-section
      v-if="icon"
      avatar
    >
      <q-icon :name="props.icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ props.title }}</q-item-label>
      <q-item-label caption>{{ props.caption }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';

const router = useRouter();
const authStore = useAuthStore();


export interface EssentialLinkProps {
  title: string;
  caption?: string;
  path?: string;
  icon?: string;
  auth?: boolean;
};

const doPageRedirect = (path: string) => {
  if(path === '/logout') {
    // Handle logout
    authStore.logout();
    // After logout, redirect to login page
    router.push('/login');
    return;
  }
  if (path) {
    router.push(path);
  }
};

const props = withDefaults(defineProps<EssentialLinkProps>(), {
  caption: '',
  path: '',
  icon: '',
  auth: false,
});
</script>
