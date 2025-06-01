<template>
    <u class="text-underline">{{ data }}</u>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

defineProps<{
    data: string
}>()
</script>
