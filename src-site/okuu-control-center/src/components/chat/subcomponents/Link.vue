<template>
  <a :href="data" class="link" target="_blank" rel="noopener noreferrer">{{ data }}</a>
</template>

<script setup lang="ts">
  defineProps<{ data: string }>();
</script>

<style lang="scss" scoped>
  .link {
    color: $primary;
    text-decoration: underline;
    cursor: pointer;

    &:hover {
      text-decoration: none;
      color: rgba($color: $primary, $alpha: 0.8);
    }
    &:active {
      color: rgba($color: $primary, $alpha: 0.6);
    }
    &:visited {
      color: rgba($color: $link_visited, $alpha: 0.6);
    }
  }
</style>