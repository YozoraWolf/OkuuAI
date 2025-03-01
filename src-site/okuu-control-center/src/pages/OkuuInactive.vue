<template>
    <div class="container">
        <q-icon name="mdi-alert" class="icon" />
        <div class="text-h2">
            Could not reach OkuuAI :(
        </div>
    </div>
</template>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    text-align: center;
}

.icon {
    font-size: 200px;
    color: orange;
}

.message {
    font-size: 24px;
    color: orange;
    margin-top: 20px;
}
</style>