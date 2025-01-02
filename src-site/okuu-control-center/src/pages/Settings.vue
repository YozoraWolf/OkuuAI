<template>
    <div>
        <h1>Settings</h1>
        <p>This is the settings page.</p>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const message = ref('This is the settings page.');
</script>

<style scoped>
h1 {
    color: #333;
}

p {
    font-size: 16px;
}
</style>