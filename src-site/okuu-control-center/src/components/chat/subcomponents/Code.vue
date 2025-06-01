<template>
  <q-expansion-item
    class="code-expansion"
    dense
    expand-icon="mdi-chevron-down"
    header-class="code-expansion-header"
    :model-value="true"
    v-if="multiline"
  >
    <template #header>
      <div class="header-content full-width flex items-center">
        <q-icon name="mdi-code-tags" color="primary" size="sm" class="code-icon q-mr-md" />
        <span>Code</span>
      </div>
    </template>
    <code class="code-block">
      {{ data }}
    </code>

  </q-expansion-item>
  <span v-else class="code-inline">{{ data }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{ data: string; multiline?: boolean }>();
const multiline = props.multiline ?? false;
</script>

<style lang="scss" scoped>
.code-block {
  display: block;
  background: #111;
  color: #fff;
  border-radius: 8px;
  padding: 1em;
  font-family: 'Fira Mono', 'Consolas', 'Monaco', monospace;
  font-size: 1em;
  overflow-x: auto;
  margin: 0.5em 0;
}

.code-inline {
  background: rgba($color: #fff, $alpha: 0.05);
  color: #fff;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'Fira Mono', 'Consolas', 'Monaco', monospace;
}

.code-expansion {
  margin-bottom: 1em;
}
</style>
