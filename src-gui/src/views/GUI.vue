<script setup lang="ts">
import Chat from '../components/Chat.vue';
import InputBox from '../components/InputBox.vue';
</script>

<template>
    <div class="centered-container">
        <div class="gui_content">
            <Chat/>
            <div class="input-box">
                <InputBox/>
            </div>
        </div>
    </div>
</template>

<style>

.centered-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}

.gui_content {
    width: 50%;
    height: 80vh;
    border-radius: 10px;
    background-color: var(--color-primary);
    border: 2px solid #1f1f1f;
    box-shadow: 0 0 20px 10px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.input-box {
    position: relative;
    bottom: 0;
    padding: 0;
}


</style>