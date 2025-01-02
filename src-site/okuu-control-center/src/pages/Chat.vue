<template>
    <div>
        <h1>Chat Component</h1>
        <p>{{ message }}</p>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const message = ref('Welcome to the Chat Component!');
</script>

<style scoped>
h1 {
    color: #42b983;
}
</style>