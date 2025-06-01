<template>
    <i>{{ data }}</i>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

defineProps<{
    data: string
}>()
</script>
