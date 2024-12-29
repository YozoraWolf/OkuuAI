<template>
  <q-layout view="lHh Lpr lFf">
    <q-drawer
      v-model="drawer"
      show-if-above
      bordered
      :mini="toggleMini"
      @mouseenter="toggleMini = false"
      @mouseleave="toggleMini = true"
      :width="300"
      :breakpoint="500"
      class="drawer-transition"
    >
      <q-list>
        <EssentialLink
          v-for="link in pageList"
          :key="link.title"
          v-bind="link"
        />
      </q-list>
    </q-drawer>

    <q-page-container>
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
];

const drawer = ref(true);
const toggleMini = ref(true);

</script>

<style lang="scss" scoped>
.drawer-transition {
  transition: width 0.3s;
}
</style>