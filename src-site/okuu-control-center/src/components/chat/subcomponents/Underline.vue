<template>
    <u class="text-underline">{{ data }}</u>
</template>

<script setup lang="ts">
defineProps<{
    data: string
}>()
</script>
