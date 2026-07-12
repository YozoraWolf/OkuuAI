<template>
    <div class="global-toggles">
        <div class="toggle-item">
            <div><strong>Thinking mode</strong><span>Let compatible models reason before replying.</span></div>
            <q-toggle v-model="toggleThinking" color="secondary">
                <q-tooltip class="bg-primary text-body1">Enable this to use DeepSeek or other thinking-capable models.</q-tooltip>
            </q-toggle>
        </div>
        <div class="toggle-item">
            <div><strong>Show reasoning</strong><span>Display the model's reasoning in the conversation.</span></div>
            <q-toggle v-model="showThinkingInChat" color="secondary" />
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
.toggle-item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; border-top: 1px solid var(--surface-border); }
.toggle-item:first-child { padding-top: 0; border-top: 0; }
.toggle-item strong, .toggle-item span { display: block; }
.toggle-item strong { font-size: 0.9rem; }
.toggle-item span { max-width: 320px; margin-top: 0.2rem; color: var(--text-muted); font-size: 0.78rem; line-height: 1.45; }
</style>
