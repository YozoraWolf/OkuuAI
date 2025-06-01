<template>
  <div class="quote">
    <span v-for="(line, idx) in data" :key="idx">
      {{ line }}<br v-if="idx < data.length - 1" />
    </span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
    data: {
        type: Array as () => string[],
        required: true
    }
})
</script>

<style scoped>
.quote {
  border-left: 4px solid #ccc;
  padding-left: 1em;  
  font-style: italic;
  margin: 1em 0;
}
</style>
