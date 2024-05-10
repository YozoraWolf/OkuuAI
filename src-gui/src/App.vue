<script setup lang="ts">
import GUI from './views/GUI.vue';
import axios from 'axios';

const OKUUAI_PORT = 3009;

const close = async () => {
    console.log('close');
    window.close();

    await axios.post(`http://localhost:${OKUUAI_PORT}/gui/close`);
}

</script>

<template>
    <div class="main-cont">
        <div class="btns">
            <button class="btn" id="close" @click="close()">X</button>
        </div>

        <GUI/>
    </div>

</template>

<style>
:root {
    background-color: rgba(0, 0, 0, 0.7);
}

#app {
    width: 100%;
    height: 100%;

    margin: 0;
    padding: 0;
}

.btns {
    display: flex;
    position: absolute;
    right: 2%;
    top: 2%;

    .btn {
        align-self: right;
        background: none;
        color: white;
        text-shadow: 1px 1px 8px white;

        margin: 5px;
        padding: 0;

        
        &:focus,
        &:hover {
            outline: none;
            border: none;
        }

        transition: text-shadow 0.5s;

        &:hover {
            transition: text-shadow 0.5s;
            text-shadow: 1px 1px 16px white;
        }
    }
}


#close {
    font-size: 3rem;
}
</style>
