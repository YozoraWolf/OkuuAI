<template>
    <q-expansion-item
        v-if="showThinkingInChat"
        expand-separator
        icon="psychology"
        label="Show Thought"
        class="q-mb-md think-expansion-item"
    >
        <div class="q-ml-lg q-mt-sm q-pa-sm rounded-borders">
            <span class="text-italic">{{ data }}</span>
        </div>
    </q-expansion-item>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'
import { useConfigStore } from 'src/stores/config.store'
import { storeToRefs } from 'pinia'

const configStore = useConfigStore()
const { showThinkingInChat } = storeToRefs(configStore)

const props = defineProps({
    data: {
        type: String,
        required: true
    }
})

const { data } = props
</script>

<style lang="scss" scoped>
.think-expansion-item {
    background-color: rgba($color: #fff, $alpha: .03);
}
</style>
