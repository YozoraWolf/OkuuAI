<template>
  <q-item
    clickable
    tag="a"
    @click="() => $router.push(props.path)"
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
export interface EssentialLinkProps {
  title: string;
  caption?: string;
  path?: string;
  icon?: string;
};

const props = withDefaults(defineProps<EssentialLinkProps>(), {
  caption: '',
  path: '',
  icon: '',
});
</script>
