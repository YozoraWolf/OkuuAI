<template>
    <div class="global-toggles">
        <div class="toggle-item">
            <q-toggle v-model="toggleThinking" label="Toggle Thinking" left-label>
                <q-tooltip class="bg-primary text-body1">
                    Enable this to use DeepSeek or only valid models for thinking.
                </q-tooltip>
            </q-toggle>
        </div>
        <div class="toggle-item">
            <q-toggle v-model="showThinkingInChat" label="Show Thinking in Chat" left-label />
        </div>
    </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from 'src/stores/config.store'

const configStore = useConfigStore()
const { toggleThinking, showThinkingInChat } = storeToRefs(configStore)

watch(toggleThinking, (newValue) => {
    configStore.updateToggleThinking(newValue)
});
</script>

<style lang="scss" scoped>
.global-toggles {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>