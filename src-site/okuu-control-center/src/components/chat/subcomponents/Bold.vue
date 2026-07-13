<template>
    <b>{{ data }}</b>
</template>

<script setup lang="ts">
defineProps<{
    data: string
}>()
</script>
